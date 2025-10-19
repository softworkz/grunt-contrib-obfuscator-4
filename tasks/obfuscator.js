'use strict';

var chalk = require('chalk');

var JavaScriptObfuscator = require('javascript-obfuscator');

function obfuscate(source, options) {
    const obfuscationResult = JavaScriptObfuscator.obfuscate(source, options);
    return obfuscationResult;
}

// Converts \r\n to \n
function normalizeLf(string) {
    return string.replace(/\r\n/g, '\n');
}

function getFilename(path) {
    return path.replace(/^.*[\\\/]/, '');
}

// Dependency-free helper: performs obfuscation and writes outputs
function writeObfuscationOutput(grunt, code, destPath, execOptions, banner, fileDest) {

    try {
        // Ensure per-target sourcemap filename tracks the output path
        if (execOptions.sourceMap) {
            execOptions.sourceMapFileName = destPath + '.map';
        }

        const result = obfuscate(code, execOptions);

        const obfuscated = result.getObfuscatedCode();
        const output = banner + obfuscated;
        grunt.file.write(destPath, output);

        if (execOptions.sourceMap) {
            let srcMap = result.getSourceMap();

            const replaceFrom = '"sources":["sourceMap"]';
            const replaceTo = '"file": "' + fileDest + '", "sources":["' + (execOptions.sourceMapBaseUrl || '') + fileDest + '"]';

            srcMap = srcMap.replace(replaceFrom, replaceTo);

            //srcMap = srcMap.replace('.js.js', '.js.src');

            grunt.file.write(destPath + '.map', srcMap);
        }

        if (execOptions.identifierNamesCache) {
            execOptions.identifierNamesCache = result.getIdentifierNamesCache();
        }

        return true;

    } catch (err) {
        grunt.log.error(err);
        grunt.warn('JavaScript Obfuscation failed at ' + destPath + '.');
    }

    return false;
}

module.exports = function (grunt) {
    var getAvailableFiles = function (filesArray) {
        return filesArray.filter(function (filepath) {
            if (!grunt.file.exists(filepath)) {
                grunt.log.warn('Source file ' + chalk.cyan(filepath) + ' not found');
                return false;
            }
            return true;
        });
    };

    grunt.registerMultiTask('obfuscator', 'Obfuscate JavaScript', function () {
        var created = {
            maps: 0,
            files: 0
        };

        const opt = this.options({ banner: '' });
        if (opt.sourceMap && opt.banner.length > 0) {
            opt.banner = '';
            grunt.log.warn('The banner option cannot be used when the sourceMap is enabled. Removing banner option.');
        }

        this.files.forEach(function (file) {

            const options = this.options({
                banner: ''
            });

            if (options.sourceMap && options.banner.length > 0) {
                options.banner = '';
            }

            var banner = normalizeLf(options.banner);

            const availableFiles = getAvailableFiles(file.src);

            var filenameDest = getFilename(file.dest);

            var execOptions = Object.assign({
                identifiersPrefix: (options.baseIdentifiersPrefix || '_') + created.files
            }, options);

            var destFilePath = file.dest;

            if (filenameDest) {

                const totalCode = availableFiles.map(function (f) {
                    return grunt.file.read(f);
                }).join('');

                if (writeObfuscationOutput(grunt, totalCode, destFilePath, execOptions, banner, file.dest,)) {
                    created.files++;
                }

            } else {

                availableFiles.forEach(function (fileSrc) {
                    destFilePath = file.dest + fileSrc;
                    const code = grunt.file.read(fileSrc);

                    if (writeObfuscationOutput(grunt, code, destFilePath, execOptions, banner, file.dest,)) {
                        created.files++;
                    }
                });
            }
        }, this);

        if (created.files > 0) {
            grunt.log.ok(created.files + ' ' + grunt.util.pluralize(this.files.length, 'file/files') + ' created');
        } else {
            grunt.log.warn('No files created.');
        }
    });
};