"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var mongoose_1 = require("mongoose");
var ColorSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    hexCode: { type: String, required: true },
});
var Color = mongoose_1.default.model("Color", ColorSchema);
exports.default = Color;
