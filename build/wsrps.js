"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WSRPServer = exports.WSRPSConnection = void 0;
var events_1 = require("events");
var websocket_1 = __importDefault(require("websocket"));
var http_1 = __importDefault(require("http"));
var beson_1 = __importDefault(require("beson"));
var trimid_js_1 = __importDefault(require("./lib/trimid.js"));
;
var _WSRPSConnection = new WeakMap();
var WSRPSConnection = /** @class */ (function () {
    function WSRPSConnection(conn) {
        _WSRPSConnection.set(this, {
            ref_conn: conn,
            close_info: null
        });
    }
    Object.defineProperty(WSRPSConnection.prototype, "id", {
        get: function () {
            var ref = _WSRPSConnection.get(this).ref_conn;
            return _WSCONNPRofile.get(ref).id;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(WSRPSConnection.prototype, "connect_time", {
        get: function () {
            var ref = _WSRPSConnection.get(this).ref_conn;
            return _WSCONNPRofile.get(ref).connect_time;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(WSRPSConnection.prototype, "close_info", {
        get: function () {
            var close_info = _WSRPSConnection.get(this).close_info;
            return close_info ? __assign({}, close_info) : null;
        },
        enumerable: false,
        configurable: true
    });
    WSRPSConnection.prototype.raw_send = function (data) {
        var ref = _WSRPSConnection.get(this).ref_conn;
        if (typeof data === "string") {
            ref.sendUTF(data);
        }
        else {
            ref.sendBytes(Buffer.from(data));
        }
        return this;
    };
    WSRPSConnection.prototype.send = function (data, use_json) {
        if (use_json === void 0) { use_json = false; }
        return this.raw_send(use_json ? JSON.stringify(data) : beson_1.default.Serialize(data));
    };
    WSRPSConnection.prototype.disconnect = function (code, reason) {
        if (code === void 0) { code = 1000; }
        if (reason === void 0) { reason = undefined; }
        if (code !== undefined && typeof code !== "number") {
            throw new TypeError("Param 'code' must be a number!");
        }
        if (reason !== undefined && typeof reason !== "string") {
            throw new TypeError("Param 'reason' must be a string!");
        }
        _WSRPSConnection.get(this).close_info = { code: code, reason: reason };
    };
    return WSRPSConnection;
}());
exports.WSRPSConnection = WSRPSConnection;
var DEFAULT_MAX_FORMAT_ERRORS = 5;
var _WSCONNPRofile = new WeakMap();
var _WSRPServer = new WeakMap();
var WSRPServer = /** @class */ (function (_super) {
    __extends(WSRPServer, _super);
    function WSRPServer(options) {
        var _this = _super.call(this) || this;
        options = options || {};
        var init_options = Object(options) === options ? options : {};
        var http_server = init_options.http_server || http_1.default.createServer();
        var ws_server = new websocket_1.default.server({ httpServer: http_server, autoAcceptConnections: false });
        _WSRPServer.set(_this, {
            http_server: http_server,
            ws_server: ws_server,
            connections: new Map(),
            callmap: {},
            MAX_FORMAT_ERRORS: init_options.max_format_errors || DEFAULT_MAX_FORMAT_ERRORS
        });
        ws_server.on('request', CLIENT_REQUESTED.bind(_this));
        return _this;
    }
    WSRPServer.prototype.register = function (name, callback) {
        var callmap = _WSRPServer.get(this).callmap;
        if (callmap[name]) {
            throw new RangeError("Procedure name '".concat(name, "' has been occupied!"));
        }
        callmap[name] = callback;
        return this;
    };
    WSRPServer.prototype.deregister = function (name) {
        var callmap = _WSRPServer.get(this).callmap;
        if (callmap[name]) {
            delete callmap[name];
        }
        return this;
    };
    WSRPServer.prototype.on = function (event, callback) {
        return _super.prototype.on.call(this, event, callback);
    };
    WSRPServer.prototype.listen = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var http_server = _WSRPServer.get(this).http_server;
        return new Promise(function (resolve, reject) {
            http_server.once('error', reject);
            http_server.listen.apply(http_server, __spreadArray(__spreadArray([], args, false), [function () {
                    var addr_info = http_server.address();
                    console.log(addr_info);
                    if (addr_info === null)
                        return resolve('');
                    if (typeof addr_info === "string")
                        return resolve(addr_info);
                    if (addr_info.family === 'IPv6')
                        return resolve("[".concat(addr_info.address, "]:").concat(addr_info.port));
                    return resolve("".concat(addr_info.address, ":").concat(addr_info.port));
                }], false));
        });
    };
    WSRPServer.prototype.close = function () {
        var _a = _WSRPServer.get(this), http_server = _a.http_server, ws_server = _a.ws_server;
        return new Promise(function (resolve, reject) {
            ws_server.shutDown();
            http_server.close(function (err) { return err ? reject(err) : resolve(); });
        });
    };
    return WSRPServer;
}(events_1.EventEmitter));
exports.WSRPServer = WSRPServer;
function CLIENT_REQUESTED(request) {
    var connections = _WSRPServer.get(this).connections;
    var conn = request.accept();
    var conn_id = trimid_js_1.default.NEW.toString(32);
    var connect_time = Math.floor(Date.now() / 1000);
    connections.set(conn_id, conn);
    var session_ctrl = new WSRPSConnection(conn);
    _WSCONNPRofile.set(conn, {
        id: conn_id,
        server: this,
        connect_time: connect_time,
        error_counts: {
            invalid_format: 0
        },
        session: session_ctrl
    });
    conn.on('message', CLIENT_MESSAGE).on('close', CLIENT_CLOSED);
    console.log("Client ".concat(conn_id, " has connected!"));
    this.emit('connected', session_ctrl);
}
function CLIENT_MESSAGE(message) {
    var _this = this;
    var _a = _WSCONNPRofile.get(this), conn_id = _a.id, server = _a.server, error_counts = _a.error_counts, connect_time = _a.connect_time, session = _a.session;
    var _b = _WSRPServer.get(server), callmap = _b.callmap, MAX_ALLOWED_FORMAT_ERRORS = _b.MAX_FORMAT_ERRORS;
    var data, use_json;
    if (message.type === 'utf8') {
        data = JSON.parse(message.utf8Data);
        use_json = true;
    }
    else {
        data = beson_1.default.Deserialize(message.binaryData);
        use_json = false;
    }
    if (typeof data.id !== "string" || typeof data.method !== "string" || !Array.isArray(data.params)) {
        var counts = error_counts.invalid_format++;
        if (counts > MAX_ALLOWED_FORMAT_ERRORS) {
            this.close(1008, 'too-many-invalid-requests');
        }
        else {
            console.error("Receiving invalid request payload from remote client ".concat(conn_id, "!"));
        }
        return;
    }
    data.id = data.id.trim();
    data.method = data.method.trim();
    if (!data.method) {
        var counts = error_counts.invalid_format++;
        if (counts > MAX_ALLOWED_FORMAT_ERRORS) {
            this.close(1008, 'too-many-invalid-requests');
        }
        else {
            console.error("Receiving invalid request payload fields from remote client ".concat(conn_id, "!"));
        }
        return;
    }
    var handler = callmap[data.method];
    if (typeof handler !== "function") {
        var response = { id: data.id, error: {
                code: 'error#invalid-method',
                message: "Requested method doesn't exist!",
                data: { method: data.method }
            } };
        CLIENT_SEND_MSG(this, use_json, response);
        return;
    }
    Promise.resolve()
        .then(function () { return handler.call.apply(handler, __spreadArray([session], data.params, false)); })
        .then(function (res) { return CLIENT_SEND_MSG(_this, use_json, { id: data.id, result: res }); })
        .catch(function (e) {
        if (!(e instanceof Error)) {
            console.error("Catched none error rejection from client ".concat(conn_id, " (id:").concat(data.id, ", method:").concat(data.method, ")!"), e);
            var new_error = new Error("Catched none error rejection when executing method '".concat(data.method, "'!"));
            new_error.data = { error: e, method: data.method };
            e = new_error;
        }
        console.error("Received unexpected error when");
        CLIENT_SEND_MSG(_this, use_json, { id: data.id, error: {
                code: e.code || 'error#unkown-error',
                message: e.message,
                stack: e.stack,
                data: e.data
            } });
    })
        .finally(function () {
        if (session.close_info === null)
            return;
        var _a = session.close_info, code = _a.code, reason = _a.reason;
        _this.close(code, reason);
    });
}
function CLIENT_CLOSED(code, desc) {
    var _a = _WSCONNPRofile.get(this), conn_id = _a.id, server = _a.server, session = _a.session;
    var connections = _WSRPServer.get(server).connections;
    connections.delete(conn_id);
    server.emit('disconnected', session, code, desc);
}
function CLIENT_SEND_MSG(conn, json, message) {
    if (json) {
        conn.sendUTF(JSON.stringify(message));
    }
    else {
        conn.sendBytes(Buffer.from(beson_1.default.Serialize(message)));
    }
}
