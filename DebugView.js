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

class DebugView {
    #toot;
    #internals;
    #threadStates;

    constructor(toot, internals) {
        this.#toot = toot;
        this.#internals = internals;
        this.#threadStates = [];
    }

    updateThreadState(threadName, location, instruction, memory) {
        this.#saveThreadState(threadName, location, instruction, memory);
        this.#setSelection(location.row, location.col, instruction.length);
        this.#updateView();
    }

    updateThreadEnded(threadName) {
        this.#threadStates = this.#threadStates.filter((state) => state.name !== threadName);
        this.#updateView();
    }

    #saveThreadState(threadName, location, instruction, memory) {
        for (const state of this.#threadStates) {
            if (state.name === threadName) {
                state.location = location;
                state.instruction = instruction;
                state.memory = memory;
                return;
            }
        }
        this.#threadStates.push({name: threadName, location, instruction, memory});
    }

    #setSelection(row, col, length) {
        const range = document.createRange();
        let x = 0, y = 0;
        let node = this.#toot.firstChild;
        while (!(y === row && x === col)) {
            if (node.tagName.toLowerCase() === 'br') {
                y++;
                x = 0;
            } else {
                x++;
            }
            node = node.nextSibling;
        }
        range.setStartBefore(node);
        for (let i = 0; i < length - 1; i++)
            node = node.nextSibling;
        range.setEndAfter(node);

        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }

    #updateView() {
        if (this.#threadStates.length === 0) {
            this.#internals.innerHTML = 'Nothing is running.';
            return;
        }

        // TODO: show the memory too
        this.#internals.innerHTML = this.#threadStates.map((state) => `
            <p>Thread name: <tt>${state.name}</tt></p>
            <p>Instruction: <tt>${state.instruction.text}</tt> (${state.location.row + 1}:${state.location.col + 1})</p>
            <p>Memory: ${state.memory.map((x) => `<tt>${x}</tt>`).join('')}</p>
        `).join('');
    }
}
