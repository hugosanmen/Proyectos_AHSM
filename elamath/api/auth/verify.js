import { wrap } from '../../server/http.js';
import { routes } from '../../server/routes.js';

export default wrap(routes.authVerify, { methods: ['POST'] });
