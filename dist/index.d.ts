declare type DefineList = Map<string, string | FunctionMacro>;

export declare function evaluateExpression(expression: string, defines: DefineList): ExpressionValue;

declare type ExpressionValue = number | boolean | undefined | string;

export declare type FinalLine = {
    sourceName?: string;
    line: string;
    originLine: number;
    includeLine?: FinalLine;
};

declare type FunctionMacro = {
    args: string[];
    replacement: string;
};

export declare class WgslPreprocessor {
    static setWgslInclude(name: string, source: string): void;
    static getWgslInclude(name: string): string | undefined;
    static preprocessWgsl(source: string, defines?: DefineList): string;
    static getIncludeList(source: string, defines?: DefineList): Set<string>;
    static preprocessWgslSourceMap(source: string, defines?: DefineList): FinalLine[];
}

export { }
