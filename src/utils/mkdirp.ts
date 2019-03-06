import { promisify } from "util";
import mkdirp = require("mkdirp");

export const mkdirpAsync = promisify(mkdirp);