type TypedArray = Uint8Array | Uint8ClampedArray | Int8Array | Uint16Array | Int16Array | Uint32Array | Int32Array | Float32Array | Float64Array;
declare class TrimId {
    constructor(id?: TrimId | ArrayBuffer | TypedArray);
    toString(format?:16|32|64): string;
    toJSON(): string;
    toBytes(): any;
    get bytes(): any;
    get timestamp(): number;
    get machine_id(): number;
    get session_id(): number;
    get seq(): number;
    static get NEW(): TrimId;
    static from(input?: TrimId | ArrayBuffer | TypedArray): TrimId | null;
    static fromHex(input: string): TrimId | null;
    static fromBase64Sort(input: string): TrimId | null;
    static fromBase32Hex(input: string): TrimId | null;
}
export = TrimId;
