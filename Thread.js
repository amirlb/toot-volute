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

class Thread {
    #name;
    #program;
    #instructionPointer;
    #memory;
    #debugView;

    constructor(name, program, startLocation, input, debugView) {
        this.#name = name;
        this.#program = program;
        this.#instructionPointer = startLocation;
        this.#memory = input;
        this.#debugView = debugView;
        this.#updateDebugView();
    }

    isRunning() {
        return this.#instructionPointer !== null;
    }

    step() {
        const instruction = this.#program.readWord(this.#instructionPointer, false);
        this.#performInstruction(instruction);
        this.#updateDebugView();
    }

    #updateDebugView() {
        if (this.#debugView !== null) {
            if (this.isRunning()) {
                const instruction = this.#program.readWord(this.#instructionPointer, false);
                this.#debugView.updateThreadState(this.#name, this.#instructionPointer, instruction, this.#memory);
            } else {
                this.#debugView.updateThreadEnded(this.#name);
            }
        }
    }

    #performInstruction(instructionWord) {
        const instruction = this.#normalizeInstruction(instructionWord.text);
        switch (instruction[0]) {
            case 'l': this.#performLoad(instruction.substring(1)); break;
            case 's': this.#performSave(instruction.substring(1)); break;
            case 'm': this.#performMath(instruction[1], instruction.substring(2)); break;
            case 'j': if (this.#isTrue(this.#memory.pop())) {this.#jump(instruction.substring(1)); return;} break;
            case 'J': this.#jump(instruction.substring(1)); return;
            case 'h': this.#instructionPointer = null; return;
            case 'f': this.#findByPrefix(instruction.substring(1)); break;
            case 'p': this.#appendWord(); break;
            case 'o': this.#addLineAfter(); break;
            case 'd': this.#deleteWord(); break;
            case 'c': this.#deleteLetter(); break;
            case 'n': this.#paste(); break;
            case 't': this.#moveTo(instruction.substring(1)); break;
            case 'u': this.#memory.pop(); break;
            case 'v': let a = this.#memory.pop(); let b = this.#memory.pop(); this.#memory.push(a); this.#memory.push(b); break;
            case 'w': let x = this.#memory.pop(); this.#memory.push(x); this.#memory.push(x); break;
            case 'y': this.#readLetter(); break;
            case 'r': this.#indirectJump(); return;
        }
        this.#instructionPointer = this.#program.nextWordLocation({
            row: this.#instructionPointer.row,
            col: this.#instructionPointer.col + instructionWord.length
        });
    }

    #normalizeInstruction(instruction) {
        const SYNONYMS = {
            '🔼': 'l',
            '🔽': 's',
            '🧮': 'm',
            '❓': 'j',
            '❗': 'J',
            '⛔': 'h',
            '🔍': 'f',
            '✏️': 'p',
            '🗑️': 'd'
        };

        for (const [from, to] of Object.entries(SYNONYMS))
            if (instruction.startsWith(from))
                instruction = to + instruction.substring(from.length);

        return instruction;
    }

    #isTrue(x) {
        return !([0, '', '0'].includes(x));
    }

    #performLoad(prefix) {
        const location = this.#program.findByPrefix(prefix);
        if (location === null)
            return;
        this.#memory.push(this.#program.readWord(location, false).text.slice(prefix.length));
    }

    #performSave(prefix) {
        const location = this.#program.findByPrefix(prefix);
        if (location === null)
            return;
        const value = this.#memory.pop();
        const { length } = this.#program.readWord(location, false);
        const delta = this.#program.replace(location, length, prefix + value);
        if (location.row === this.#instructionPointer.row && location.col < this.#instructionPointer.col) {
            this.#instructionPointer = {
                row: this.#instructionPointer.row,
                col: this.#instructionPointer.col + delta - length
            };
        }
    }

    #performMath(operator, operand) {
        // TODO: add more operators
        const isTrue = (x) => this.#isTrue(x);
        const UNARY = {
            '!': function(x) {return (!isTrue(x)) * 1;}
        };
        const BINARY = {
            '<': function(x, y) {return (x < y) * 1;},
            '>': function(x, y) {return (x > y) * 1;},
            '+': function(x, y) {return x + y;},
            '&': function(x, y) {return x & y;},
        }
        if (operator === '=') {
            const arg2 = (operand.length === 0) ? this.#memory.pop().toString() : operand;
            const arg1 = this.#memory.pop().toString();
            this.#memory.push(arg1 === arg2 ? '1' : '0');
        } else if (UNARY.hasOwnProperty(operator)) {
            const arg = parseInt(this.#memory.pop());
            this.#memory.push(UNARY[operator](arg).toString());
        } else if (BINARY.hasOwnProperty(operator)) {
            const arg2 = (operand.length === 0) ? parseInt(this.#memory.pop()) : parseInt(operand);
            const arg1 = parseInt(this.#memory.pop());
            this.#memory.push(BINARY[operator](arg1, arg2).toString());
        }
    }

    #jump(prefix) {
        this.#instructionPointer = this.#program.findByPrefix(prefix);
    }

    #indirectJump() {
        this.#instructionPointer = this.#popLocation();
    }

    #pushLocation(location) {
        this.#memory.push(`${location.row + 1}:${location.col + 1}`);
    }

    #popLocation() {
        const [row, col] = this.#memory.pop().split(':');
        return { row: parseInt(row) - 1, col: parseInt(col) - 1 };
    }

    #findByPrefix(prefix) {
        const location = this.#program.findByPrefix(prefix);
        if (location === null)
            return;
        this.#pushLocation(location);
    }

    #appendWord() {
        const word = this.#memory.pop();
        const location = this.#popLocation();
        const currentWord = this.#program.readWord(location, false);
        const insertLocation = { row: location.row, col: location.col + currentWord.length };
        const delta = this.#program.replace(insertLocation, 0, ' ' + word);
        if (location.row === this.#instructionPointer.row && location.col < this.#instructionPointer.col) {
            this.#instructionPointer = {
                row: this.#instructionPointer.row,
                col: this.#instructionPointer.col + delta
            }
        }
        this.#pushLocation({ row: location.row, col: location.col + currentWord.length + 1 })
    }

    #deleteWord() {
        const location = this.#popLocation();
        const { length } = this.#program.readWord(location, true);
        this.#program.replace(location, length, '');
        if (location.row === this.#instructionPointer.row && location.col < this.#instructionPointer.col) {
            this.#instructionPointer = {
                row: this.#instructionPointer.row,
                col: this.#instructionPointer.col - length
            }
        }
        this.#pushLocation(location);
    }

    #deleteLetter() {
        const location = this.#popLocation();
        this.#program.replace(location, 1, '');
        if (location.row === this.#instructionPointer.row && location.col < this.#instructionPointer.col) {
            this.#instructionPointer = {
                row: this.#instructionPointer.row,
                col: this.#instructionPointer.col - 1
            }
        }
        this.#pushLocation(location);
    }

    #paste() {
        const text = this.#memory.pop();
        const location = this.#popLocation();
        const length = this.#program.replace(location, 0, text);
        if (location.row === this.#instructionPointer.row && location.col <= this.#instructionPointer.col) {
            this.#instructionPointer = {
                row: this.#instructionPointer.row,
                col: this.#instructionPointer.col + length
            }
        }
    }

    #addLineAfter() {
        const { row } = this.#popLocation();
        this.#program.addLine(row + 1);
        if (row <= this.#instructionPointer.row) {
            this.#instructionPointer = {
                row: this.#instructionPointer.row + 1,
                col: this.#instructionPointer.col
            };
        }
        this.#pushLocation({ row: row + 1, col: 0 });
    }

    #moveTo(direction) {
        const { row, col } = this.#popLocation();
        switch(direction) {
            case 'up': this.#pushLocation({ row: row - 1, col }); break;
            case 'down': this.#pushLocation({ row: row + 1, col }); break;
            case 'left': this.#pushLocation({ row, col: col - 1 }); break;
            case 'right': this.#pushLocation({ row, col: col + 1 }); break;
        }
    }

    #readLetter() {
        const location = this.#popLocation();
        this.#memory.push(this.#program.getLetterAt(location));
    }
}