import { wrap } from '../server/http.js';
import { routes } from '../server/routes.js';

export default wrap(routes.scan, { methods: ['POST'], maxBody: 2.2 * 1024 * 1024 });
