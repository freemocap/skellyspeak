// Disposable credential test. Interaction is disabled: a required password prompt
// is a test failure. The only item touched has the unique service supplied by the test.
#include <Security/Security.h>
#include <CoreFoundation/CoreFoundation.h>
#include <stdio.h>
#include <string.h>

#ifndef BUILD_MARKER
#define BUILD_MARKER 1
#endif

int main(int argc, char **argv) {
    if (argc != 3 || strncmp(argv[2], "skellyspeak-signing-test-", 23) != 0) return 2;
    OSStatus status = SecKeychainSetUserInteractionAllowed(false);
    if (status != errSecSuccess) return 3;
    const char *service = argv[2];
    const char *account = "fixture";
    const char *value = "disposable-test-value";
    if (strcmp(argv[1], "create") == 0) {
        status = SecKeychainAddGenericPassword(NULL, (UInt32)strlen(service), service,
            (UInt32)strlen(account), account, (UInt32)strlen(value), value, NULL);
    } else {
        SecKeychainItemRef item = NULL;
        UInt32 length = 0;
        void *data = NULL;
        status = SecKeychainFindGenericPassword(NULL, (UInt32)strlen(service), service,
            (UInt32)strlen(account), account, &length, &data, &item);
        if (status == errSecSuccess) {
            if (strcmp(argv[1], "delete") == 0) status = SecKeychainItemDelete(item);
            else if (strcmp(argv[1], "read") != 0 || length != strlen(value) || memcmp(data, value, length) != 0) status = errSecDecode;
        }
        if (data) SecKeychainItemFreeContent(NULL, data);
        if (item) CFRelease(item);
    }
    printf("build=%d operation=%s status=%d\n", BUILD_MARKER, argv[1], (int)status);
    return status == errSecSuccess ? 0 : 1;
}
