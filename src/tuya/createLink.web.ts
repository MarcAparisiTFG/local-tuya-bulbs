import { createBridgeLink } from './bridgeLink';
import { Link, LinkTarget } from './link';
import { getBridgeUrl, getMode } from './mode';
import { createSimLink } from './simLink';

export const createLink = (b: LinkTarget): Promise<Link> => (getMode() === 'bridge' ? createBridgeLink(b, getBridgeUrl()) : createSimLink(b));
