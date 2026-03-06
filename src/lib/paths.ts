/**
 * Centralized path configuration for Mission Control.
 * All paths derive from HOME and OPENCLAW_HOME env vars.
 * No hardcoded user-specific paths.
 */
import path from 'path'

export const HOME = process.env.HOME || process.env.USERPROFILE || '/root'
export const OPENCLAW_HOME = process.env.OPENCLAW_HOME || path.join(HOME, '.openclaw')
export const OPENCLAW_CONFIG = path.join(OPENCLAW_HOME, 'openclaw.json')
export const WORKSPACE_PATH = process.env.WORKSPACE_DIR || path.join(OPENCLAW_HOME, 'workspace')
export const AGENTS_DIR = path.join(OPENCLAW_HOME, 'agents')
export const DATA_DIR = path.join(process.cwd(), 'data')
