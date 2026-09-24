"""Verify actual platform permissions; POSIX mode bits do not describe Windows ACLs."""
import os
import stat


def assert_private(path):
    if os.name != 'nt':
        assert stat.S_IMODE(path.stat().st_mode) == (0o700 if path.is_dir() else 0o600)
        return
    import ntsecuritycon
    import win32api
    import win32con
    import win32security
    token = win32security.OpenProcessToken(win32api.GetCurrentProcess(), win32con.TOKEN_QUERY)
    try:
        user = win32security.GetTokenInformation(token, win32security.TokenUser)[0]
    finally:
        token.Close()
    descriptor = win32security.GetFileSecurity(str(path),
        win32security.OWNER_SECURITY_INFORMATION | win32security.DACL_SECURITY_INFORMATION)
    assert descriptor.GetSecurityDescriptorOwner() == user
    assert descriptor.GetSecurityDescriptorControl()[0] & win32security.SE_DACL_PROTECTED
    acl = descriptor.GetSecurityDescriptorDacl()
    assert acl is not None and acl.GetAceCount() == 1
    (kind, flags), rights, principal = acl.GetAce(0)
    assert kind == win32security.ACCESS_ALLOWED_ACE_TYPE
    assert not flags & win32security.INHERITED_ACE
    assert rights == ntsecuritycon.FILE_ALL_ACCESS
    assert principal == user


def directory_link(link, target):
    if os.name == 'nt':
        # Junctions exercise reparse-point rejection without symlink privileges.
        import _winapi
        _winapi.CreateJunction(str(target), str(link))
    else:
        link.symlink_to(target, target_is_directory=True)


def file_link(link, target):
    if os.name == 'nt':
        link.hardlink_to(target)
    else:
        link.symlink_to(target)
