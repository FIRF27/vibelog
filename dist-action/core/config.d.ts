import { type Config } from "./types.js";
type Env = Record<string, string | undefined>;
export declare function configFromEnv(env: Env): Partial<Config>;
export declare function loadConfigFile(cwd: string): Partial<Config>;
export declare function mergeConfig(opts: {
    defaults?: Config;
    fileConfig?: Partial<Config>;
    env?: Partial<Config>;
    flags?: Partial<Config>;
}): Config;
export {};
