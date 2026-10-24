#!/usr/bin/env node
'use strict';
/** R75 replaces the legacy browser confirm. The R57 safety scenarios now test
 * the actual production gate, with React callback injection and revalidation.
 */
require('./test_r75_pwa_gate.cjs');
