import { registerSa11yMatcher } from '@sa11y/jest';
import { setTrustedSignalSet } from '@lwc/engine-dom';

registerSa11yMatcher();

// Prevent LWC's experimental signals system from treating plain objects/arrays
// as signals. Without this, LWC 9.2+ warns on every reactive property access
// that returns a non-null object when ENABLE_EXPERIMENTAL_SIGNALS is on.
setTrustedSignalSet(new Set());
