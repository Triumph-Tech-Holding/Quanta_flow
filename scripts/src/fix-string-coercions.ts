import { Project, SyntaxKind, Node } from "ts-morph";
import * as path from "path";
import * as fs from "fs";

const targets = process.argv.slice(2).map((p) => path.resolve(process.cwd(), p));

const project = new Project({ skipAddingFilesFromTsConfig: true });
for (const t of targets) project.addSourceFileAtPath(t);

let totalFixed = 0;

for (const sf of project.getSourceFiles()) {
  let fixedInFile = 0;
  let changed = true;
  while (changed) {
    changed = false;
    const accesses = sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
      .concat(sf.getDescendantsOfKind(SyntaxKind.ElementAccessExpression) as any);
    for (const pa of accesses) {
      // Skip if parent is already a String() call wrapping this exact expr
      const parent = pa.getParent();
      if (!parent) continue;
      // Match patterns: req.query.X, req.headers["x"], req.params.X (params often already string but query/headers union)
      const text = pa.getText();
      const isQuery = /^req\.query\./.test(text) || /^req\.query\[/.test(text);
      const isHeaders = /^req\.headers\./.test(text) || /^req\.headers\[/.test(text);
      const isParams = /^req\.params\./.test(text) || /^req\.params\[/.test(text);
      if (!isQuery && !isHeaders && !isParams) continue;
      // Skip if already wrapped: parent is CallExpression and callee is String/Number/Boolean
      if (Node.isCallExpression(parent)) {
        const callee = parent.getExpression().getText();
        if (callee === "String" || callee === "Number" || callee === "Boolean" || callee === "JSON.parse") {
          // already wrapped or being parsed — skip
          if (parent.getArguments()[0] === pa) continue;
        }
      }
      // Skip declarations like `const foo = req.query.bar` (assignments OK to leave)
      if (Node.isVariableDeclaration(parent) && parent.getInitializer() === pa) continue;
      if (Node.isPropertyAssignment(parent) && parent.getInitializer() === pa) continue;
      // Skip when used as condition or in logical/comparison/typeof
      if (Node.isBinaryExpression(parent)) continue;
      if (Node.isPrefixUnaryExpression(parent)) continue;
      if (Node.isIfStatement(parent)) continue;
      if (Node.isConditionalExpression(parent)) continue;
      if (Node.isTypeOfExpression(parent)) continue;
      if (Node.isPropertyAccessExpression(parent) || Node.isElementAccessExpression(parent)) continue;
      // Only wrap if used as argument or initializer where string is expected
      if (Node.isCallExpression(parent) || Node.isNewExpression(parent)) {
        const args = parent.getArguments();
        if (!args.includes(pa as any)) continue;
        pa.replaceWithText(`String(${text})`);
        fixedInFile++;
        changed = true;
        break;
      }
      if (Node.isReturnStatement(parent)) {
        pa.replaceWithText(`String(${text})`);
        fixedInFile++;
        changed = true;
        break;
      }
      if (Node.isTemplateSpan(parent)) {
        // template strings handle union OK
        continue;
      }
    }
  }
  if (fixedInFile > 0) {
    sf.saveSync();
    console.log(`${path.basename(sf.getFilePath())}: ${fixedInFile} coercions`);
    totalFixed += fixedInFile;
  }
}
console.log(`Total: ${totalFixed}`);
