declare module 'word-wrapper' {
    interface WordWrapLine {
        start: number;
        end: number;
    }

    type WordWrapMode = 'pre' | 'nowrap';

    type WordWrapMeasureFn<T extends WordWrapLine> = (
        text: string,
        start: number,
        end: number,
        width: number
    ) => T;

    interface WordWrapOptions<T extends WordWrapLine = WordWrapLine> {
        width?: number;
        start?: number;
        end?: number;
        mode?: WordWrapMode;
        measure?: WordWrapMeasureFn<T>;
    }

    interface WordWrapper {
        (text: string, options?: WordWrapOptions): string;
        lines<T extends WordWrapLine>(text: string, options?: WordWrapOptions<T>): T[];
    }

    const wordWrapper: WordWrapper;

    export { WordWrapLine, WordWrapMode, WordWrapMeasureFn, WordWrapOptions, WordWrapper };

    export = wordWrapper;
}

