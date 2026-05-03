import { Project, SyntaxKind, Node, FunctionLikeDeclaration } from "ts-morph";
import * as path from "path";

const target = path.resolve(process.cwd(), process.argv[2] ?? "../artifacts/api-server/src/routes/routes.ts");

const project = new Project({ tsConfigFilePath: undefined, skipAddingFilesFromTsConfig: true });
const sf = project.addSourceFileAtPath(target);

let fixedReturns = 0;
let fixedStringCoercions = 0;

function endsWithExitStatement(body: Node): boolean {
  if (!Node.isBlock(body)) return true;
  const stmts = body.getStatements();
  if (stmts.length === 0) return false;
  const last = stmts[stmts.length - 1];
  const k = last.getKind();
  return (
    k === SyntaxKind.ReturnStatement ||
    k === SyntaxKind.ThrowStatement ||
    k === SyntaxKind.WhileStatement && last.getText().startsWith("while (true)")
  );
}

function hasInnerReturnWithValue(body: Node): boolean {
  let found = false;
  body.forEachDescendant((d, traverse) => {
    if (Node.isFunctionLikeDeclaration(d) || Node.isArrowFunction(d) || Node.isFunctionExpression(d)) {
      traverse.skip();
      return;
    }
    if (Node.isReturnStatement(d)) {
      const e = d.getExpression();
      if (e) {
        found = true;
        traverse.stop();
      }
    }
  });
  return found;
}

const fns: Node[] = [];
sf.forEachDescendant((node) => {
  if (Node.isArrowFunction(node) || Node.isFunctionExpression(node) || Node.isFunctionDeclaration(node) || Node.isMethodDeclaration(node)) {
    fns.push(node);
  }
});

for (const fn of fns) {
  const body = (fn as any).getBody?.();
  if (!body || !Node.isBlock(body)) continue;
  if (endsWithExitStatement(body)) continue;
  if (!hasInnerReturnWithValue(body)) continue;
  const stmts = body.getStatements();
  if (stmts.length === 0) continue;
  body.addStatements("return;");
  fixedReturns++;
}

// Now fix string|string[] coercions for req.params.X / req.query.X / req.headers[X]
const calls = sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
for (const pa of calls) {
  const expr = pa.getExpression();
  const exprText = expr.getText();
  if (!/^req\.(params|query)$/.test(exprText)) continue;
  // pa is `req.params.x`
  const parent = pa.getParent();
  if (!parent) continue;
  // Check if used as argument where string is needed and pa already wrapped in String()
  const grand = parent.getText();
  if (grand.startsWith("String(")) continue;
  // We won't auto-fix this here; keeping conservative.
}

sf.saveSync();
console.log(`Fixed ${fixedReturns} missing returns in ${path.basename(target)}`);
console.log(`String coercions auto-fixes: ${fixedStringCoercions}`);
