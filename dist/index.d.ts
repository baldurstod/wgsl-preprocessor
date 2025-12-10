export declare function addWgslInclude(name: string, source: string): void;

export declare type FinalLine = {
    sourceName?: string;
    line: string;
    originalLine: number;
    includeLine?: FinalLine;
};

export declare function getWgslInclude(name: string): string | undefined;

export declare function preprocessWgsl(source: string, defines?: Map<string, string>): string;

export declare function preprocessWgslLineMap(source: string, defines?: Map<string, string>): [string, FinalLine[]];

export { }
