"""Handle-based private-file access for the local Windows launcher."""
import msvcrt
import os

import ntsecuritycon
import pywintypes
import win32api
import win32con
import win32file
import win32security


def _identity():
    token = win32security.OpenProcessToken(win32api.GetCurrentProcess(), win32con.TOKEN_QUERY)
    try:
        return win32security.GetTokenInformation(token, win32security.TokenUser)[0]
    finally:
        token.Close()


def _attributes(directory: bool):
    sid = _identity()
    acl = win32security.ACL()
    inheritance = win32con.OBJECT_INHERIT_ACE | win32con.CONTAINER_INHERIT_ACE if directory else 0
    acl.AddAccessAllowedAceEx(win32security.ACL_REVISION, inheritance, ntsecuritycon.FILE_ALL_ACCESS, sid)
    attributes = pywintypes.SECURITY_ATTRIBUTES()
    attributes.SECURITY_DESCRIPTOR.SetSecurityDescriptorOwner(sid, False)
    attributes.SECURITY_DESCRIPTOR.SetSecurityDescriptorDacl(True, acl, False)
    attributes.SECURITY_DESCRIPTOR.SetSecurityDescriptorControl(
        win32security.SE_DACL_PROTECTED, win32security.SE_DACL_PROTECTED)
    return attributes, sid, acl


def _protect(handle, *, directory: bool, sid, acl):
    info = win32file.GetFileInformationByHandle(handle)
    if info[0] & win32con.FILE_ATTRIBUTE_REPARSE_POINT:
        raise RuntimeError('Private local files cannot use symlinks or junctions.')
    if bool(info[0] & win32con.FILE_ATTRIBUTE_DIRECTORY) != directory:
        raise RuntimeError('Private local file has an unexpected type.')
    if not directory and info[7] != 1:
        raise RuntimeError('Private local file must not have aliases.')
    security = win32security.GetSecurityInfo(handle, win32security.SE_FILE_OBJECT,
                                           win32security.OWNER_SECURITY_INFORMATION)
    if security.GetSecurityDescriptorOwner() != sid:
        raise RuntimeError('Private local file must belong to the current user.')
    win32security.SetSecurityInfo(handle, win32security.SE_FILE_OBJECT,
        win32security.DACL_SECURITY_INFORMATION | win32security.PROTECTED_DACL_SECURITY_INFORMATION,
        None, None, acl, None)


def directory(path, *, create: bool):
    attributes, sid, acl = _attributes(True)
    if create:
        win32file.CreateDirectory(str(path), attributes)
    handle = win32file.CreateFile(str(path), win32con.READ_CONTROL | win32con.WRITE_DAC,
        win32con.FILE_SHARE_READ | win32con.FILE_SHARE_WRITE, None, win32con.OPEN_EXISTING,
        win32con.FILE_FLAG_BACKUP_SEMANTICS | win32file.FILE_FLAG_OPEN_REPARSE_POINT, None)
    try:
        _protect(handle, directory=True, sid=sid, acl=acl)
    finally:
        handle.Close()


def open_file(path, *, reading: bool) -> int:
    attributes, sid, acl = _attributes(False)
    try:
        handle = win32file.CreateFile(str(path),
            (win32con.GENERIC_READ if reading else win32con.GENERIC_WRITE)
            | win32con.READ_CONTROL | win32con.WRITE_DAC,
            win32con.FILE_SHARE_READ | win32con.FILE_SHARE_WRITE, attributes,
            win32con.OPEN_EXISTING if reading else win32con.CREATE_NEW,
            win32file.FILE_FLAG_OPEN_REPARSE_POINT, None)
    except pywintypes.error as error:
        if error.winerror in (80, 183):
            raise FileExistsError('Private local file already exists.') from None
        if error.winerror in (2, 3):
            raise FileNotFoundError('Private local file does not exist.') from None
        raise
    try:
        _protect(handle, directory=False, sid=sid, acl=acl)
        descriptor = msvcrt.open_osfhandle(int(handle), os.O_RDONLY if reading else os.O_WRONLY)
        handle.Detach()  # The Python descriptor now owns this handle.
        return descriptor
    except BaseException:
        handle.Close()
        raise
