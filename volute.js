// Toot Volute - an interpreter for Mastodon posts, following Luci for Chai Tea
// Copyright (C) 2022 Amir Livne Bar-on
// 
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// 
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
// 
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

import './intl-segmenter-polyfill.js';

const SegmenterPromise =
    (Intl && Intl.Segmenter)
        ? new Promise((resolve) => {resolve(Intl.Segmenter);})
        : IntlSegmenterPolyfillBundled.createIntlSegmenterPolyfill();

export class Interpreter {
    constructor(elt, monitor) {
        this.elt = elt;
        this.monitor = monitor;
        this.isRunning = false;
        this.toot = [];
        this.parse = [];
        this.currentInstruction = null;
    }

    async start () {
        if (this.isRunning)
            throw 'Already running';

        const tootText = this.elt.innerText;
        const Segmenter = await SegmenterPromise;
        this.toot = Array.from(
            new Segmenter('en', {granularity: 'grapheme'}).segment(tootText),
            ({segment}) => segment
        );
        this._replaceContents();

        this._parseToot();
        for (const line of this.parse) {
            if (line.segmentStart && this._isVoluteHeader(line.line)) {
                this.currentInstruction = this._nextInstruction(line.end);
                if (this.currentInstruction)
                    this.isRunning = true;
                break;
            }
        }

        this._updateView();
    }

    step() {
        if (this.currentInstruction === null) {
            // TODO: only stop running if no more listeners exist
            this.isRunning = false;
        } else {
            console.log(`Performing ${this.toot.slice(this.currentInstruction[0], this.currentInstruction[1]).join('')}`);
            this.currentInstruction = this._nextInstruction(this.currentInstruction[1]);
        }
        this._updateView();
    }

    run() {
        if (this.isRunning) {
            const self = this;
            setTimeout(function () {
                self.step();
                self.run();
            }, 200);
        }
    }

    stop() {
        this.isRunning = false;
        this._updateView();
    }

    _updateView() {
        this.elt.setAttribute('contenteditable', !this.isRunning);
        if (this.isRunning) {
            const selection = window.getSelection();
            selection.removeAllRanges();
            if (this.currentInstruction) {
                const range = document.createRange();
                range.setStart(this.elt, this.currentInstruction[0]);
                range.setEnd(this.elt, this.currentInstruction[1]);
                selection.addRange(range);
            }
        }
        this.monitor({
            isRunning: this.isRunning,
            currentInstruction: this.currentInstruction
        });
    }

    _replaceContents() {
        this.elt.innerText = '';
        for (const letter of this.toot) {
            if (letter === '\n') {
                this.elt.appendChild(document.createElement('br'));
            } else {
                const span = document.createElement('span');
                span.classList.add('letter');
                span.innerText = letter;
                this.elt.appendChild(span);
            }
        }
    }

    _parseToot() {
        this.parse = [];
        let lastLineStart = 0;
        let afterEmptyLine = true;
        for (let i = 0; i <= this.toot.length; i++) {
            if (i === this.toot.length || this.toot[i] === '\n') {
                const line = this.toot.slice(lastLineStart, i);
                const isEmpty = line.every((letter) => /\s/.test(letter));
                this.parse.push({
                    line,
                    isEmpty,
                    segmentStart: afterEmptyLine && !isEmpty,
                    start: lastLineStart,
                    end: i
                });
                lastLineStart = i + 1;
                afterEmptyLine = isEmpty;
            }
        }
    }

    _isVoluteHeader(line) {
        if (line.every((letter) => letter === '🐌'))
            return true;

        return /^\s*--+\s+volute(\s.*)?$/.test(line.join(''));
    }

    _nextInstruction(ind) {
        while (ind < this.toot.length && /\s/.test(this.toot[ind])) {
            ind++;
        }
        if (ind === this.toot.length)
            return null;
        let end = ind + 1;
        for (; end < this.toot.length; end++)
            if (/\s/.test(this.toot[end]))
                break;
        return [ind, end];
    }
}