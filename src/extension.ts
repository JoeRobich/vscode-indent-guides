import {workspace, window, commands, Position, Range, TextLine, TextDocument, TextEditor, TextEditorDecorationType, ExtensionContext, Disposable} from 'vscode'; 
import {range, debounce} from 'lodash';

export function activate(context:ExtensionContext) {
    let guideDecorator = new GuideDecorator();
    
    // Hook Events
    let subscriptions:Disposable[] = [];
    workspace.onDidChangeTextDocument(debounce(onEditorChange.bind(null, guideDecorator), 50), this, subscriptions);
    window.onDidChangeActiveTextEditor(guideDecorator.updateActiveEditor, guideDecorator, subscriptions);
    workspace.onDidChangeConfiguration(guideDecorator.reset, guideDecorator, subscriptions);
    let eventDisposable = Disposable.from(...subscriptions);
    
    // Register Disposables
    context.subscriptions.push(guideDecorator);
    context.subscriptions.push(eventDisposable);
    
    guideDecorator.reset();
}

function onEditorChange(guideDecorator:GuideDecorator) {
    let activeEditor = window.activeTextEditor;
    let cursorPosition = activeEditor.selection.active;
    let cursorLine = activeEditor.document.lineAt(cursorPosition.line);
    let indentation = cursorLine.isEmptyOrWhitespace ? cursorLine.text.length : cursorLine.firstNonWhitespaceCharacterIndex;
    
    if (!activeEditor.selection.isEmpty ||          // Change to large area, possibly a snippet.
        cursorPosition.character <= indentation)    // Change within the indentation area.
        guideDecorator.updateActiveEditor();
}

class GuideDecorator {
    private _indentGuide:TextEditorDecorationType = null;
    
    public updateActiveEditor():void {
        this.updateIndentGuides(window.activeTextEditor);
    }
    
    updateVisibleEditors():void {
        for (let editor of window.visibleTextEditors)
            this.updateIndentGuides(editor);
    }
    
    updateIndentGuides(editor:TextEditor):void {
        if (editor === null)
            return;
        
        let guideStops:Range[] = this.getIndentedLines(editor.document)
            .map(line => this.getGuideStops(line, editor.options.tabSize))
            .reduce((all, ranges) => all.concat(ranges), []);
        
        editor.setDecorations(this._indentGuide, guideStops);
    }
    
    getIndentedLines(document:TextDocument):TextLine[] {
        return range(0, document.lineCount)
            .map(lineNumber => document.lineAt(lineNumber))
            .filter(line => line.firstNonWhitespaceCharacterIndex != 0);
    }
    
    getGuideStops(line:TextLine, tabSize:number):Range[] {
        let stopSize = line.text[0] === '\t' ? 1 : tabSize; // Currently expects the indentation to be either tabs or spaces. Produces strange output when both are used on the same line.
        let indentation = line.isEmptyOrWhitespace ? line.text.length : line.firstNonWhitespaceCharacterIndex;
        let depth = indentation / stopSize;
        
        return range(1, depth)
            .map(stop => new Position(line.lineNumber, stop * stopSize))
            .map(position => new Range(position, position));
    }
    
    public reset() {
        this.dispose();
        this._indentGuide = this.createIndentGuideDecoration();
        this.updateVisibleEditors();
    }
    
    createIndentGuideDecoration():TextEditorDecorationType {
        var configuration:any = workspace.getConfiguration("indent-guide");
        return window.createTextEditorDecorationType({
            outlineColor: configuration.color,
            outlineWidth: "1px",
            outlineStyle: configuration.style
        });
    }
    
    dispose() {
        if (this._indentGuide !== null)
            this._indentGuide.dispose();
    }
}