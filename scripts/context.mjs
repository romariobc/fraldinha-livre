// Read selected context by default. Only `graph --write` creates generated graph artifacts.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ts = createRequire(import.meta.url)('typescript')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const hash = text => crypto.createHash('sha256').update(text).digest('hex')
const key = file => path.resolve(file).replaceAll('\\', '/').toLowerCase()
const listSources = () => execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
  .split('\0').filter(file => /^(front\/src\/|back\/src\/|packages\/contracts\/src\/)/.test(file) && /\.tsx?$/.test(file) && !/__tests__|\.(test|spec)\./.test(file) && fs.existsSync(path.join(root, file)))
const details = file => ({ file, lines: read(file).split(/\r?\n/).length, sha256: hash(read(file)) })
const configurations = new Map()

function imports(file) {
  const absolute = path.resolve(root, file)
  if (!absolute.startsWith(root + path.sep) || !/\.tsx?$/.test(file)) throw new Error('Informe um arquivo TS/TSX dentro do projeto.')
  const workspace = file.startsWith('packages/') ? 'packages/contracts' : file.split('/')[0]
  if (!configurations.has(workspace)) {
    const config = path.join(root, workspace, 'tsconfig.json')
    configurations.set(workspace, ts.parseJsonConfigFileContent(ts.readConfigFile(config, ts.sys.readFile).config, ts.sys, path.dirname(config)).options)
  }
  return ts.preProcessFile(read(file), true, true).importedFiles.map(item => {
    const result = ts.resolveModuleName(item.fileName, absolute, configurations.get(workspace), ts.sys).resolvedModule
    let resolved = result?.resolvedFileName
    if (resolved) resolved = fs.realpathSync(resolved)
    return { specifier: item.fileName, file: resolved && key(resolved).startsWith(key(root) + '/') && !resolved.includes('node_modules') ? path.relative(root, resolved).replaceAll('\\', '/') : null }
  })
}

export function validateBoundaries(file, text) {
  const errors = []
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  for (const item of source.statements.filter(ts.isImportDeclaration)) {
    const module = item.moduleSpecifier.text
    if (['recharts', '@tanstack/react-table'].includes(module)) errors.push(`${file}: use import explícito de lib/compat, não alias de biblioteca.`)
    if (/(account|supplier)-mock$/.test(module) && item.importClause?.namedBindings && ts.isNamedImports(item.importClause.namedBindings)) {
      for (const binding of item.importClause.namedBindings.elements) {
        const name = (binding.propertyName ?? binding.name).text
        if (!/^(MOCK_|INITIAL_)/.test(name)) errors.push(`${file}: ${name} pertence a domain/ ou formatters, não a fixtures.`)
      }
    }
  }
  if (file.startsWith('front/src/contexts/') && /\bcreateContext\b/.test(text)) {
    const first = source.statements[0]
    if (!first || !ts.isExpressionStatement(first) || first.expression.text !== 'use client') errors.push(`${file}: provider deve começar com use client.`)
  }
  return errors
}

export function checkContext() {
  const errors = []
  const packets = JSON.parse(read('context/packets.json'))
  for (const packet of Object.values(packets)) for (const file of packet.files) if (!fs.existsSync(path.join(root, file))) errors.push('Caminho inexistente: ' + file)
  for (const file of listSources()) errors.push(...validateBoundaries(file, read(file)))
  for (const [file, max] of [['context/estado/progresso.md', 100], ['context/README.md', 120], ['front/src/components/fornecedor/OrdersDataTable.tsx', 450], ['front/src/app/(comprador)/checkout/page.tsx', 450]]) {
    if (read(file).split(/\r?\n/).length > max) errors.push(`${file}: excedeu orçamento de ${max} linhas; separar responsabilidades/histórico.`)
  }
  const config = JSON.parse(read('front/tsconfig.json'))
  for (const alias of ['recharts', '@tanstack/react-table']) if (config.compilerOptions.paths[alias]) errors.push('Alias oculto: ' + alias)
  for (const file of ['AGENTS.md', '.agents/skills/domain-comprador/SKILL.md', '.agents/skills/domain-fornecedor/SKILL.md', '.agents/skills/domain-catalogo/SKILL.md']) {
    if (read(file).includes('(main)/minha-conta')) errors.push(file + ': caminho antigo de minha-conta.')
  }
  return { ok: errors.length === 0, checkedSources: listSources().length, errors }
}

function graph(write) {
  const files = listSources()
  const nodes = files.map(file => ({ id: file, label: file, file_type: 'code', source_file: file, source_location: 'L1', _origin: 'typescript-imports', sha256: hash(read(file)) }))
  const available = new Set(files)
  const links = files.flatMap(file => imports(file).filter(item => available.has(item.file)).map(item => ({ source: file, target: item.file, relation: 'imports', confidence: 'EXTRACTED' })))
  const result = { directed: true, multigraph: false, graph: { generator: 'scripts/context.mjs', kind: 'local-module-imports', note: 'Inclui imports de tipos; não comprova chamadas/runtime nem substitui testes.' }, nodes, links }
  if (write) {
    const target = path.join(root, 'graphify-out')
    fs.mkdirSync(target, { recursive: true })
    const existing = path.join(target, 'graph.json')
    const archive = path.join(target, 'graph-before-ctx-01.json')
    if (fs.existsSync(existing) && !fs.existsSync(archive)) fs.copyFileSync(existing, archive)
    fs.writeFileSync(existing, JSON.stringify(result))
  }
  return { ...result.graph, files: nodes.length, imports: links.length, written: write, output: write ? 'graphify-out/graph.json' : undefined }
}

export function main([command, argument, option] = []) {
  if (command === 'status') {
    const data = JSON.parse(read('context/estado/feature_list.json'))
    const feature = data.features.find(item => item.id === argument)
    if (!feature) throw new Error('Item não encontrado: ' + argument)
    return { feature, dependencies: (feature.dependencias ?? []).map(id => { const item = data.features.find(entry => entry.id === id); return { id, status: item?.status, approval: item?.aprovacao_usuario } }), execution: data.plano_atual.controle_execucao }
  }
  if (command === 'packet') {
    const packets = JSON.parse(read('context/packets.json'))
    if (!argument) return Object.fromEntries(Object.entries(packets).map(([name, value]) => [name, value.description]))
    if (!packets[argument]) throw new Error('Pacote não encontrado: ' + argument)
    return { description: packets[argument].description, files: packets[argument].files.map(details), note: 'Selecione os arquivos necessários; não é uma lista de leitura obrigatória.' }
  }
  if (command === 'imports') { const dependencies = imports(argument); return { ...details(argument), imports: dependencies } }
  if (command === 'graph') return graph(argument === '--write' || option === '--write')
  if (command === 'check') return checkContext()
  return { commands: ['status MP-04', 'packet', 'packet checkout', 'imports front/src/contexts/orders-context.tsx', 'graph', 'graph --write', 'check'] }
}

if (process.argv[1] && key(process.argv[1]) === key(fileURLToPath(import.meta.url))) {
  try { const result = main(process.argv.slice(2)); console.log(JSON.stringify(result, null, 2)); if (result.ok === false) process.exitCode = 1 }
  catch (error) { console.error(error.message); process.exitCode = 1 }
}
