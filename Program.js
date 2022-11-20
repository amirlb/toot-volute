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

class Program {
    #view;
    #immediateUpdates;
    #lines;
    #entryPoint;

    constructor(view, immediateUpdates) {
        this.#view = view;
        this.#immediateUpdates = immediateUpdates;
        this.#lines = view.getProgramLines();
        this.#updateEntryPoints();
    }

    getStartLocation() {
        return this.#entryPoint;
    }

    updateView() {
        const combined = [];
        let first = true;
        for (const line of this.#lines) {
            if (!first)
                combined.push('newline');
            first = false;
            combined.push(...line);
        }
        this.#view.replaceRange(0, Infinity, combined);
    }

    readWord({ row, col }, includeTrailingSpaces) {
        const line = this.#lines[row];
        const letters = [];
        for (; col < line.length; col++) {
            const letter = line[col].letter;
            if (/\s+/.test(letter))
                break;
            letters.push(letter);
        }
        if (includeTrailingSpaces) {
            for (; col < line.length; col++) {
                const letter = line[col].letter;
                if (!/\s+/.test(letter))
                    break;
                letters.push(letter);
            }
        }
        return {
            text: letters.join(''),
            length: letters.length
        };
    }

    nextWordLocation({ row, col }) {
        while (row < this.#lines.length) {
            const line = this.#lines[row];
            while (col < line.length) {
                if (!/\s+/.test(line[col].letter))
                    return { row, col };
                col++;
            }
            row++;
            col = 0;
        }
        return null;
    }

    findByPrefix(prefix) {
        let location = { row: 0, col: 0 };
        while (location !== null) {
            const word = this.readWord(location, false);
            if (word.text.startsWith(prefix))
                return location;
            location = this.nextWordLocation({ row: location.row, col: location.col + word.length });
        }
        return null;
    }

    replace(location, length, text) {
        const letters = this.#view.splitGraphemes(text).map((letter) => ({
            letter,
            // TODO: what about formatting? simple? copy existing?
        }));
        this.#lines[location.row].splice(location.col, length, ...letters);
        if (this.#immediateUpdates) {
            const intLocation = this.#lines.slice(0, location.row).reduce((i, line) => i + line.length + 1, location.col);
            this.#view.replaceRange(intLocation, length, letters);
        }

        if (location.row <= this.#entryPoint.row)
            this.#updateEntryPoints();

        return letters.length;
    }

    addLine(beforeRow) {
        this.#lines.splice(beforeRow, 0, []);
        if (this.#immediateUpdates) {
            const intLocation = this.#lines.slice(0, beforeRow).reduce((i, line) => i + line.length + 1, 0);
            this.#view.replaceRange(intLocation, 0, ['newline']);
        }

        if (beforeRow <= this.#entryPoint.row)
            this.#entryPoint = { row: this.#entryPoint.row + 1, col: this.#entryPoint.col };
    }

    getLetterAt(location) {
        return this.#lines[location.row][location.col].letter;
    }

    getClickHandlerLocations() {
        const clickHandlers = [];
        let location = this.#entryPoint;
        while (location !== null) {
            const word = this.readWord(location, false);
            if (word.text.startsWith('MOUSE'))
                clickHandlers.push(location);
            location = this.nextWordLocation({ row: location.row, col: location.col + word.length });
        }
        return clickHandlers;
    }

    #updateEntryPoints() {
        this.#entryPoint = null;

        let newParagraph = true;
        for (let i = 0; i < this.#lines.length - 1; i++) {
            const line = this.#lines[i];
            if (newParagraph && this.#isVoluteHeader(line)) {
                this.#entryPoint = this.nextWordLocation({ row: i + 1, col: 0 });
                break;
            }
            newParagraph = (line.length === 0);
        }
    }

    #isVoluteHeader(line) {
        const text = line.map(({ letter }) => letter).join('');
        return /^(🐌+|--+\s+volute(\s.*)?)$/.test(text);
    }
}
