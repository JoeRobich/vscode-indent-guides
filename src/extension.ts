import {workspace, window, commands, Position, Range, TextLine, TextDocument, TextEditor, TextEditorDecorationType, ExtensionContext, Disposable} from 'vscode'; 
import {range} from 'lodash';

export function activate(context:ExtensionContext) {
    let guideDecorator = new GuideDecorator();
    
    // Hook Events
    let subscriptions:Disposable[] = [];
    window.onDidChangeTextEditorSelection(guideDecorator.updateActiveEditor, guideDecorator, subscriptions);
    window.onDidChangeActiveTextEditor(guideDecorator.updateActiveEditor, guideDecorator, subscriptions);
    workspace.onDidChangeConfiguration(guideDecorator.reset, guideDecorator, subscriptions);
    let eventDisposable = Disposable.from(...subscriptions);
    
    // Register Disposables
    context.subscriptions.push(guideDecorator);
    context.subscriptions.push(eventDisposable);
    
    guideDecorator.reset();
}

class GuideDecorator {
    private _indentGuide:TextEditorDecorationType = null;
    private _lastDocumentId:string = "";
    
    public updateActiveEditor():void {
        this.updateIndentGuides(window.activeTextEditor);
    }
    
    updateVisibleEditors():void {
        for (let editor of window.visibleTextEditors)
            this.updateIndentGuides(editor);
    }
    
    updateIndentGuides(editor:TextEditor):void {
        if (this.doesEditorNeedUpdating(editor))
            return;
        
        let ranges:Range[] = this.getIndentedLines(editor.document)
            .map(line => this.getGuideStops(line, editor.options.tabSize))
            .reduce((all, ranges) => all.concat(ranges), []);
        
        editor.setDecorations(this._indentGuide, ranges);
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
    
    doesEditorNeedUpdating(editor:TextEditor):boolean {
        if (!editor)
            return false;
        
        let documentId = `${editor.document.fileName}:${editor.document.version}`;
        if (documentId === this._lastDocumentId)
            return false;
        
        this._lastDocumentId = documentId;
        return true;        
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