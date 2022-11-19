"use strict";

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

class ProgramView {
    #IntlSegmenter;
    #elt;

    static async create(elt) {
        if (Intl && Intl.Segmenter) {
            return new ProgramView(Intl.Segmenter, elt);
        } else {
            // Why does the polyfill library return a promise?!?
            const IntlSegmenter = await IntlSegmenterPolyfillBundled.createIntlSegmenterPolyfill();
            return new ProgramView(IntlSegmenter, elt);
        }
    }

    constructor(IntlSegmenter, elt) {
        this.#IntlSegmenter = IntlSegmenter;
        this.#elt = elt;
    }

    splitGraphemes(text) {
        const segmenter = new this.#IntlSegmenter('en', {granularity: 'grapheme'});
        return Array.from(segmenter.segment(text), ({ segment }) => segment);
    }

    setProgram(text) {
        const segmenter = new this.#IntlSegmenter('en', {granularity: 'grapheme'});
        this.#elt.innerText = '';
        for (const item of segmenter.segment(text)) {
            const grapheme = item.segment;
            if (grapheme === '\n')
                this.#elt.appendChild(document.createElement('br'));
            else
                this.#elt.appendChild(this.#createSpanWith(grapheme));
        }
    }

    getProgramLines() {
        const lines = [[]];
        for (const elt of this.#elt.children) {
            if (elt.tagName.toLowerCase() === 'br') {
                lines.push([]);
            } else {
                lines[lines.length - 1].push({
                    letter: elt.innerText
                    // TODO: add formatting
                });
            }
        }
        return lines;
    }

    replaceRange(location, length, marks) {
        let node = this.#elt.children[location];
        while (node && length) {
            const next = node.nextSibling;
            this.#elt.removeChild(node);
            length--;
            node = next;
        }
        for (const mark of marks) {
            if (mark === 'newline') {
                this.#elt.insertBefore(document.createElement('br'), node);
            } else {
                // TODO: handle formatting
                this.#elt.insertBefore(this.#createSpanWith(mark.letter), node);
            }
        }
    }

    #createSpanWith(text) {
        const span = document.createElement('span');
        span.innerText = text;
        return span;
    }
}
