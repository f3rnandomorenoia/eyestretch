// @ts-check

import { init } from './src/main.js?v=20260323b';

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

