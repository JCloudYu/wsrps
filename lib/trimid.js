/**
 *	Author: JCloudYu
 *	Create: 2020/06/28
**/
(()=>{
	"use strict";
	
	// See http://www.isthe.com/chongo/tech/comp/fnv/#FNV-param for the definition of these parameters;
	const FNV_PRIME_HIGH = 0x0100, FNV_PRIME_LOW = 0x0193;	// 16777619 0x01000193
	const OFFSET_BASIS = new Uint8Array([0xC5, 0x9D, 0x1C, 0x81]);	// 2166136261 [0x81, 0x1C, 0x9D, 0xC5]
	const IS_NODEJS = typeof Buffer !== "undefined";
	
	
	
	const RUNTIME = {
		SEQ:Math.floor(Math.random() * 0xFFFFFFFF),
		PID:0, PPID:0, MACHINE_ID:null
	};
	
	if ( IS_NODEJS ) {
		RUNTIME.MACHINE_ID = fnv1a32(UTF8Encode(require('os').hostname()));
		RUNTIME.PID = process.pid;
		RUNTIME.PPID = process.ppid;
	}
	else {
		const HOSTNAME_CANDIDATES = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWZYZ_-";
	
		let hostname = '', count = 30;
		while(count-- > 0) {
			hostname += HOSTNAME_CANDIDATES[(Math.random() * HOSTNAME_CANDIDATES.length)|0]
		}
		RUNTIME.MACHINE_ID = fnv1a32(UTF8Encode(hostname));
		RUNTIME.PID = (Math.random() * 65535)|0;
		RUNTIME.PPID = (Math.random() * 65535)|0;
	}
	
	
	
	const PRIVATE = new WeakMap();
	class TrimId {
		constructor(id=null) {
			let input_buffer = null;
			if ( id instanceof TrimId ) {
				input_buffer = PRIVATE.get(id).buffer;
			}
			else
			// Uint8Array & NodeJS Buffer
			if ( id instanceof Uint8Array ) {
				input_buffer = id;
			}
			else
			if ( ArrayBuffer.isView(id) ) {
				input_buffer = new Uint8Array(id.buffer);
			}
			else
			if ( id instanceof ArrayBuffer ) {
				input_buffer = new Uint8Array(id);
			}
			
			
			
			let result_buffer = null;
			if ( input_buffer === null ) {
				const time	= Date.now();
				if ( time > 0xFFFFFFFF && TrimId.showTimeOverflowWarning ) {
					console.warn("System timestamp now is greater than 4294967295! The generated id's timestamp will be started over from 0!");
				}
				
				const time_lower = time%0xFFFFFFFF;
				const inc	= (RUNTIME.SEQ=(RUNTIME.SEQ+1) % 0xFFFFFFFF);
				const buff	= new Uint8Array(14);
				const view	= new DataView(buff.buffer);
				
				view.setUint32(0, time_lower, false);				// [0-3] epoch time upper
				buff.set(RUNTIME.MACHINE_ID, 4);					// [4-7] machine id
				view.setUint16(8, RUNTIME.PID,  false);				// [8-9] pid
				view.setUint32(10, inc,	 false);					// [10-13] seq
				
				
				
				result_buffer = buff;
			}
			else {
				if ( input_buffer.length < 14 ) {
					throw new TypeError( "Given input buffer must be at least 20 bytes long!" );
				}
				
				// Prevent unexpected pre-allocated bytes from NodeJS Buffer
				result_buffer = new Uint8Array(input_buffer.slice(0, 14));
			}
			
			
			
			const _UniqueId = Object.create(null);
			_UniqueId.buffer = result_buffer;
			
			PRIVATE.set(this, _UniqueId);
		}
		toString(format=64) {
			const buffer = PRIVATE.get(this).buffer;
			
			switch(format) {
				case 64:
					return Base64SortEncode(buffer);
				
				case 32:
					return Base32Encode(buffer);
				
				case 16:
					return HexEncode(buffer);
				
				default:
					throw new SyntaxError(`Cannot cast unique-id as \`${format}\``);
			}
			
		}
		toJSON() {
			return this.toString();
		}
		toBytes() { return  PRIVATE.get(this).buffer.slice(0); }
		
		get bytes() {
			return PRIVATE.get(this).buffer;
		}
		
		
		
		static get NEW() {
			return new TrimId();
		}
		static from(input) {
			try { return new TrimId(input); } catch(e) { return null; }
		}
		static fromHex(input) {
			try {
				const buffer = HexDecode(input);
				return new TrimId(buffer);
			} catch(e) { return null; }
		}
	}
	TrimId.showTimeOverflowWarning = false;
	
	
	
	// HEX
	const HEX_MAP	 = "0123456789abcdef";
	const HEX_MAP_R	 = {
		"0":0, "1":1, "2":2, "3":3,
		"4":4, "5":5, "6":6, "7":7,
		"8":8, "9":9, "a":10, "b":11,
		"c":12, "d":13, "e":14, "f":15
	};
	const HEX_FORMAT = /^(0x)?([0-9a-fA-F]+)$/;
	function HexEncode(bytes) {
		let result = '';
		for(let i=0; i<bytes.length; i++) {
			const value = bytes[i];
			result += HEX_MAP[(value&0xF0)>>>4] + HEX_MAP[value&0x0F];
		}
		
		return result;
	}
	function HexDecode(input) {
		const matches = input.match(HEX_FORMAT);
		if ( !matches ) {
			throw new Error("Given input is not a valid hex string!");
		}
	
		let [,,hex_string] = matches;
		if ( hex_string.length % 2 === 0 ) {
			hex_string = hex_string.toLowerCase();
		}
		else {
			hex_string = '0' + hex_string.toLowerCase();
		}
		
		
		
		const buff = new Uint8Array((hex_string.length/2)|0);
		for ( let i=0; i<buff.length; i++ ) {
			const offset = i * 2;
			buff[i] = HEX_MAP_R[hex_string[offset]]<<4 | (HEX_MAP_R[hex_string[offset+1]] & 0x0F);
		}
		
		return buff;
	}
	
	// Base64Sort
	const BASE64SORT_ENCODE_CHAR = '0123456789=ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz'.split('');
	function Base64SortEncode(bytes) {
		var v1, v2, v3, base64Str = '', length = bytes.length;
		for( var i = 0, count = ((length/3)>>>0) * 3; i < count; ){
			v1 = bytes[i++];
			v2 = bytes[i++];
			v3 = bytes[i++];
			base64Str += BASE64SORT_ENCODE_CHAR[v1 >>> 2] +
				BASE64SORT_ENCODE_CHAR[(v1 << 4 | v2 >>> 4) & 63] +
				BASE64SORT_ENCODE_CHAR[(v2 << 2 | v3 >>> 6) & 63] +
				BASE64SORT_ENCODE_CHAR[v3 & 63];
		}
		
		// remain char
		var remain = length - count;
		if( remain === 1 ){
			v1 = bytes[i];
			base64Str += BASE64SORT_ENCODE_CHAR[v1 >>> 2] + BASE64SORT_ENCODE_CHAR[(v1 << 4) & 63] + '';
		}
		else if( remain === 2 ){
			v1 = bytes[i++];
			v2 = bytes[i];
			base64Str += BASE64SORT_ENCODE_CHAR[v1 >>> 2] + BASE64SORT_ENCODE_CHAR[(v1 << 4 | v2 >>> 4) & 63] + BASE64SORT_ENCODE_CHAR[(v2 << 2) & 63] + '';
		}
		return base64Str;
	}
	
	// Base32
	const BASE32_MAP = "0123456789abcdefghijklmnopqrstuv".split('');
	function Base32Encode(bytes) {
		if ( bytes.length < 1 ) return '';
		
		
		// Run complete bundles
		let encoded = '';
		let begin, loop = Math.floor(bytes.length/5);
		for (let run=0; run<loop; run++) {
			begin = run * 5;
			encoded += BASE32_MAP[  bytes[begin]           >> 3];								// 0
			encoded += BASE32_MAP[ (bytes[begin  ] & 0x07) << 2 | (bytes[begin+1] >> 6)];	// 1
			encoded += BASE32_MAP[ (bytes[begin+1] & 0x3E) >> 1];								// 2
			encoded += BASE32_MAP[ (bytes[begin+1] & 0x01) << 4 | (bytes[begin+2] >> 4)];	// 3
			encoded += BASE32_MAP[ (bytes[begin+2] & 0x0F) << 1 | (bytes[begin+3] >> 7)];	// 4
			encoded += BASE32_MAP[ (bytes[begin+3] & 0x7C) >> 2];								// 5
			encoded += BASE32_MAP[ (bytes[begin+3] & 0x03) << 3 | (bytes[begin+4] >> 5)];	// 6
			encoded += BASE32_MAP[  bytes[begin+4] & 0x1F];										// 7
		}
		
		// Run remains
		let remain = bytes.length % 5;
		if ( remain === 0 ) { return encoded; }
		
		
		begin = loop*5;
		if ( remain === 1 ) {
			encoded += BASE32_MAP[  bytes[begin]           >> 3];								// 0
			encoded += BASE32_MAP[ (bytes[begin  ] & 0x07) << 2];								// 1
		}
		else
		if ( remain === 2 ) {
			encoded += BASE32_MAP[  bytes[begin]           >> 3];								// 0
			encoded += BASE32_MAP[ (bytes[begin  ] & 0x07) << 2 | (bytes[begin+1] >> 6)];	// 1
			encoded += BASE32_MAP[ (bytes[begin+1] & 0x3E) >> 1];								// 2
			encoded += BASE32_MAP[ (bytes[begin+1] & 0x01) << 4];								// 3
		}
		else
		if ( remain === 3 ) {
			encoded += BASE32_MAP[  bytes[begin]           >> 3];								// 0
			encoded += BASE32_MAP[ (bytes[begin  ] & 0x07) << 2 | (bytes[begin+1] >> 6)];	// 1
			encoded += BASE32_MAP[ (bytes[begin+1] & 0x3E) >> 1];								// 2
			encoded += BASE32_MAP[ (bytes[begin+1] & 0x01) << 4 | (bytes[begin+2] >> 4)];	// 3
			encoded += BASE32_MAP[ (bytes[begin+2] & 0x0F) << 1];								// 4
		}
		else
		if ( remain === 4 ) {
			encoded += BASE32_MAP[  bytes[begin]           >> 3];								// 0
			encoded += BASE32_MAP[ (bytes[begin  ] & 0x07) << 2 | (bytes[begin+1] >> 6)];	// 1
			encoded += BASE32_MAP[ (bytes[begin+1] & 0x3E) >> 1];								// 2
			encoded += BASE32_MAP[ (bytes[begin+1] & 0x01) << 4 | (bytes[begin+2] >> 4)];	// 3
			encoded += BASE32_MAP[ (bytes[begin+2] & 0x0F) << 1 | (bytes[begin+3] >> 7)];	// 4
			encoded += BASE32_MAP[ (bytes[begin+3] & 0x7C) >> 2];								// 5
			encoded += BASE32_MAP[ (bytes[begin+3] & 0x03) << 3];								// 6
		}
		
		return encoded;
	}
	
	// Helper
	function UTF8Encode(str) {
		if ( typeof str !== "string" ) {
			throw new TypeError( "Given input argument must be a js string!" );
		}
	
		let codePoints = [];
		let i=0;
		while( i < str.length ) {
			let codePoint = str.codePointAt(i);
			
			// 1-byte sequence
			if( (codePoint & 0xffffff80) === 0 ) {
				codePoints.push(codePoint);
			}
			// 2-byte sequence
			else if( (codePoint & 0xfffff800) === 0 ) {
				codePoints.push(
					0xc0 | (0x1f & (codePoint >> 6)),
					0x80 | (0x3f & codePoint)
				);
			}
			// 3-byte sequence
			else if( (codePoint & 0xffff0000) === 0 ) {
				codePoints.push(
					0xe0 | (0x0f & (codePoint >> 12)),
					0x80 | (0x3f & (codePoint >> 6)),
					0x80 | (0x3f & codePoint)
				);
			}
			// 4-byte sequence
			else if( (codePoint & 0xffe00000) === 0 ) {
				codePoints.push(
					0xf0 | (0x07 & (codePoint >> 18)),
					0x80 | (0x3f & (codePoint >> 12)),
					0x80 | (0x3f & (codePoint >> 6)),
					0x80 | (0x3f & codePoint)
				);
			}
			
			i += (codePoint>0xFFFF) ? 2 : 1;
		}
		return new Uint8Array(codePoints);
	}
	function fnv1a32(octets) {
		const U8RESULT		= OFFSET_BASIS.slice(0);
		const U32RESULT		= new Uint32Array(U8RESULT.buffer);
		const RESULT_PROC	= new Uint16Array(U8RESULT.buffer);
		for( let i = 0; i < octets.length; i += 1 ) {
			U32RESULT[0] = U32RESULT[0] ^ octets[i];
			
			let hash_low = RESULT_PROC[0], hash_high = RESULT_PROC[1];
			
			RESULT_PROC[0] = hash_low * FNV_PRIME_LOW;
			RESULT_PROC[1] = hash_low * FNV_PRIME_HIGH + hash_high * FNV_PRIME_LOW + (RESULT_PROC[0]>>>16);
		}
		return U8RESULT;
	}
	
	
	
	
	
	
	// Export interface
	if ( typeof module !== "undefined" && Object(module) === module ) {
		module.exports = TrimId;
		return;
	}
	
	if ( typeof global !== "undefined" ) {
		global.TrimId = TrimId;
		return;
	}
	
	if ( typeof window !== "undefined" ) {
		window.TrimId = TrimId;
		return;
	}
})();
