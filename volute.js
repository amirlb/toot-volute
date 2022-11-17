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

export class Interpreter {
    constructor(elt, monitor) {
        this.elt = elt;
        this.monitor = monitor;
        this.isRunning = false;
        this.program = [];
        this.instructionPointer = {line: 0, word: 0};
        this.stack = [];
    }

    async start () {
        if (this.isRunning)
            throw 'Already running';

        this._parseToot();
        this._replaceContents();

        for (let i = 0; i < this.program.length - 1; i++) {
            const prevLine = (i === 0) ? '' : this.program[i - 1];
            const line = this.program[i];
            if (prevLine.length === 0 && this._isVoluteHeader(line)) {
                this.isRunning = true;
                this.instructionPointer = {line: i, word: line.length};
                this.stack = [];
                this._adjustInstructionPointer();
                break;
            }
        }

        this._updateView();
    }

    step() {
        if (!this.isRunning)
            throw 'Not running';

        const currentInstruction = this.program[this.instructionPointer.line][this.instructionPointer.word];
        this._performInstruction(currentInstruction);
        this._updateView();
    }

    run() {
        if (this.isRunning) {
            const self = this;
            setTimeout(function () {
                if (self.isRunning) {
                    self.step();
                    self.run();
                }
            }, 200);
        }
    }

    stop() {
        this.isRunning = false;
        this._updateView();
    }

    _adjustInstructionPointer() {
        while (this.instructionPointer.word >= this.program[this.instructionPointer.line].length) {
            this.instructionPointer.line++;
            this.instructionPointer.word = 0;
            if (this.instructionPointer.line >= this.program.length) {
                // TODO: only stop running if no handlers left
                this.isRunning = false;
                return;
            }
        }
    }

    _performInstruction(instruction) {
        const FALSE = [0, '', '0'];
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

        switch (instruction[0]) {
            case 'l': this._performLoad(instruction.substring(1)); break;
            case 's': this._performSave(instruction.substring(1)); break;
            case 'm': this._performMath(instruction[1], instruction.substring(2)); break;
            case 'j': if (!FALSE.includes(this.stack.pop())) {this._jump(instruction.substring(1)); return;} break;
            case 'J': this._jump(instruction.substring(1)); return;
            case 'h': this.isRunning = false; return;
            case 'f': this.stack.push(this._findByPrefix(instruction.substring(1))); break;
            case 'p': this._prependWord(); break;
            case 'd': this._deleteWord(); break;
        }
        this.instructionPointer.word++;
        this._adjustInstructionPointer();
    }

    _performLoad(prefix) {
        for (const line of this.program) {
            for (const word of line) {
                if (word.startsWith(prefix)) {
                    this.stack.push(word.substring(prefix.length));
                    return
                }
            }
        }
    }

    _performSave(prefix) {
        const value = this.stack.pop();
        for (const line of this.program) {
            for (let i = 0; i < line.length; i++) {
                if (line[i].startsWith(prefix)) {
                    line[i] = prefix + value;
                    this._replaceContents();
                    return;
                }
            }
        }
        this.program[this.program.length - 1].push(prefix + value);
        this._replaceContents();
    }

    _performMath(operator, operand) {
        // TODO: add more operators
        const UNARY = {
            '!': function(x) {return ['', 0, '0'].includes(x) * 1;}
        };
        const BINARY = {
            '>': function(x, y) {return (x > y) * 1;},
            '+': function(x, y) {return x + y;}
        }
        if (UNARY.hasOwnProperty(operator)) {
            const arg = parseInt(this.stack.pop());
            this.stack.push(UNARY[operator](arg).toString());
        } else if (BINARY.hasOwnProperty(operator)) {
            const arg2 = (operand.length === 0) ? parseInt(this.stack.pop()) : parseInt(operand);
            const arg1 = parseInt(this.stack.pop());
            this.stack.push(BINARY[operator](arg1, arg2).toString());
        }
    }

    _jump(label) {
        for (let i = 0; i < this.program.length; i++) {
            for (let j = 0; j < this.program[i].length; j++) {
                if (this.program[i][j] === label) {
                    this.instructionPointer.line = i;
                    this.instructionPointer.word = j;
                    return;
                }
            }
        }
    }

    _findByPrefix(prefix) {
        for (let i = 0; i < this.program.length; i++)
            for (let j = 0; j < this.program[i].length; j++)
                if (this.program[i][j].startsWith(prefix))
                    return `${i}:${j}`;
    }

    _prependWord() {
        const word = this.stack.pop();
        const [line, ind] = this.stack.pop().split(':').map((x) => parseInt(x));
        this.program[line].splice(ind, 0, word);
        if (line === this.instructionPointer.line && ind <= this.instructionPointer.word)
            this.instructionPointer.word++;
        this._replaceContents();
    }

    _deleteWord() {
        const [line, ind] = this.stack.pop().split(':').map((x) => parseInt(x));
        this.program[line].splice(ind, 1);
        if (line === this.instructionPointer.line && ind < this.instructionPointer.word)
            this.instructionPointer.word--;
        this._replaceContents();
    }

    _updateView() {
        if (this.isRunning) {
            // const line =
            //     this.instructionPointer.line === 0
            //         ? this.elt.firstChild
            //         : this.elt.getElementsByTagName('br').item(this.instructionPointer.line - 1);

            // const range = document.createRange();
            // range.setStart(line, this.instructionPointer.word);
            // range.setEnd(line, this.instructionPointer.word + 1);

            // const selection = window.getSelection();
            // selection.removeAllRanges();
            // selection.addRange(range);

            const currentInstruction = this.program[this.instructionPointer.line][this.instructionPointer.word];
            this.monitor({
                isRunning: true,
                currentInstruction: `${this.instructionPointer.line}:${this.instructionPointer.word} ${currentInstruction}`,
                stack: this.stack
            });
        } else {
            this.monitor({
                isRunning: false,
                currentInstruction: null,
                stack: []
            });
        }
    }

    _parseToot() {
        this.program = this.elt.innerText.split('\n').map(function(line) {
            line = line.trim();
            if (line.length === 0)
                return [];
            else
                return line.split(/\s+/);
        });
    }

    _replaceContents() {
        this.elt.innerText = this.program.map((line) => line.join(' ')).join('\n');
    }

    _isVoluteHeader(line) {
        if (line.length === 1 && /^🐌+$/.test(line[0]))
            return true;
        if (line.length === 2 && /^--+$/.test(line[0]) && line[1] === 'volute')
            return true;
        return false;
    }
}
