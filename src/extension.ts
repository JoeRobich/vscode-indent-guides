import {window, commands, Position, Range, TextLine, TextDocument, TextEditorDecorationType, ExtensionContext, Disposable} from 'vscode'; 
import * as _ from 'lodash';

export function activate(context:ExtensionContext) {
    var decorator = new GuideDecorator();
    var controller = new IndentGuideController(decorator);
    
    context.subscriptions.push(decorator);
    context.subscriptions.push(controller);
}

class IndentGuideController {
    private _disposable: Disposable;

    constructor(guideDecorator:GuideDecorator) {
        let subscriptions:Disposable[] = [];
        window.onDidChangeTextEditorSelection(guideDecorator.updateIndentGuides, guideDecorator, subscriptions);
        window.onDidChangeActiveTextEditor(guideDecorator.updateIndentGuides, guideDecorator, subscriptions);
        this._disposable = Disposable.from(...subscriptions);
        
        guideDecorator.updateIndentGuides();
    }

    dispose():void {
        this._disposable.dispose();
    }
}

class GuideDecorator {
    private _indentGuide:TextEditorDecorationType = window.createTextEditorDecorationType({outlineWidth: "1px", outlineStyle: "solid"});
    
    public updateIndentGuides():void {
        let editor = window.activeTextEditor;
        if (!editor)
            return;
        
        let lines:TextLine[] = this.getNonEmptyLines(editor.document);
           let ranges:Range[] = _(lines)
            .map(line => this.getGuideStops(line, editor.options.tabSize))
            .flatten<Range>()
            .value();
        
        editor.setDecorations(this._indentGuide, ranges);
    }
    
    getNonEmptyLines(document:TextDocument):TextLine[] {
        return _(_.range(0, document.lineCount))
            .map(lineNumber => document.lineAt(lineNumber))
            .filter(line => line.firstNonWhitespaceCharacterIndex != 0)
            .value();
    }
    
    getGuideStops(line:TextLine, tabSize:number):Range[] {
        tabSize = line.text[0] === '\t' ? 1 : tabSize; // Currently expects the indentation to be either tabs or spaces. Produces strange output when both are used on the same line.
        let indentation = line.isEmptyOrWhitespace ? line.text.length : line.firstNonWhitespaceCharacterIndex;
        let depth = indentation / tabSize;
        return _(_.range(1, depth))
            .map(step => new Position(line.lineNumber, step * tabSize))
            .map(position => new Range(position, position))
            .value();
    }
    
    dispose():void {
        this._indentGuide.dispose();
    }
}