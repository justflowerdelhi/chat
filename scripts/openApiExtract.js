const fs = require('fs');

const openApi = JSON.parse(fs.readFileSync('C:\\floraprise.com\\flora\\scripts\\openapi.json', 'utf8'));
const paths = openApi.paths || {};
const schemas = (openApi.components && openApi.components.schemas) || {};

function resolveSchema(refOrObj) {
  if (!refOrObj) return {};
  if (refOrObj.$ref && refOrObj.$ref.startsWith('#/components/schemas/')) {
    const name = refOrObj.$ref.replace('#/components/schemas/', '');
    return { $ref: refOrObj.$ref, ...schemas[name] };
  }
  if (refOrObj.type === 'array' && refOrObj.items) {
    return { type: 'array', items: resolveSchema(refOrObj.items) };
  }
  return refOrObj;
}

function describeSchema(obj, depth = 0) {
  if (!obj) return 'any';
  if (obj.$ref) return obj.$ref;
  if (obj.type === 'array') return `array<${describeSchema(obj.items, depth)}>`;
  if (obj.type === 'object' && obj.properties) {
    const props = {};
    for (const [k, v] of Object.entries(obj.properties)) {
      props[k] = describeSchema(v, depth + 1);
    }
    return props;
  }
  if (obj.allOf && Array.isArray(obj.allOf)) {
    return { allOf: obj.allOf.map((x) => describeSchema(x, depth)) };
  }
  const t = obj.type || 'any';
  const fmt = obj.format ? `:${obj.format}` : '';
  const nullable = obj.type && Array.isArray(obj.type) && obj.type.includes('null');
  return (t || 'any') + fmt + (nullable ? '?' : '');
}

function gatherOp(path, method) {
  const op = paths[path] && paths[path][method];
  if (!op) return null;
  const bodySchema = op.requestBody && op.requestBody.content && op.requestBody.content['application/json'] && op.requestBody.content['application/json'].schema;
  const respSchemas = {};
  if (op.responses) {
    for (const [code, resp] of Object.entries(op.responses)) {
      if (resp.content && resp.content['application/json'] && resp.content['application/json'].schema) {
        respSchemas[code] = resolveSchema(resp.content['application/json'].schema);
      } else {
        respSchemas[code] = null;
      }
    }
  }
  return {
    path,
    method,
    summary: op.summary,
    operationId: op.operationId,
    tags: op.tags,
    requestSchema: bodySchema ? resolveSchema(bodySchema) : null,
    responses: respSchemas,
    security: op.security,
    parameters: (op.parameters || []).map((p) => ({ name: p.name, in: p.in, required: p.required, schema: p.schema })),
  };
}

const authOps = [];
const productOps = [];
const designOps = [];
for (const [path, ops] of Object.entries(paths)) {
  for (const [method, op] of Object.entries(ops)) {
    if (typeof op !== 'object') continue;
    const lower = path.toLowerCase();
    if (lower.includes('auth')) authOps.push(gatherOp(path, method));
    if (lower.includes('product')) productOps.push(gatherOp(path, method));
    if (lower.includes('design') || lower.includes('gallery') || lower.includes('catalog')) designOps.push(gatherOp(path, method));
  }
}

const schemaSummary = {};
for (const [name, s] of Object.entries(schemas)) {
  if (
    /Login|Token|Auth/i.test(name) ||
    /Product|Design|Gallery|Catalog|Image/i.test(name) ||
    /Member|Company|Business/i.test(name)
  ) {
    schemaSummary[name] = { type: s.type, required: s.required, properties: describeSchema(s) };
  }
}

const summary = {
  securitySchemes: openApi.components && openApi.components.securitySchemes,
  auth: authOps,
  products: productOps,
  designGallery: designOps,
  schemas: schemaSummary,
};

fs.writeFileSync('C:\\floraprise.com\\flora\\scripts\\openapi-summary.json', JSON.stringify(summary, null, 2));
console.log('summary written to scripts/openapi-summary.json');
