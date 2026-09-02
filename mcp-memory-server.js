import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3005;
const MEMORY_FILE = path.join(__dirname, "memories.json");

app.use(express.json());

if (!fs.existsSync(MEMORY_FILE)) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify([], null, 2));
}

app.post("/mcp", (req, res) => {
  const body = req.body;
  if (!body || !body.method) {
    return res.status(400).json({ jsonrpc: "2.0", id: body?.id || null, error: { code: -32600, message: "Invalid Request" } });
  }
  const { method, id, params } = body;
  switch (method) {
    case "initialize":
      return res.json({ jsonrpc: "2.0", id, result: { protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "memory-server", version: "2.0.0" } } });
    case "tools/list":
      return res.json({ jsonrpc: "2.0", id, result: { tools: [
        { name: "memory_create", description: "创建一条记忆", inputSchema: { type: "object", properties: { content: { type: "string" }, tags: { type: "array", items: { type: "string" } } }, required: ["content"] } },
        { name: "memory_search", description: "搜索记忆", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
        { name: "memory_list", description: "列出记忆", inputSchema: { type: "object", properties: { limit: { type: "number" } } } },
        { name: "memory_delete", description: "按ID删除一条记忆", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
        { name: "memory_clear", description: "清空所有记忆", inputSchema: { type: "object", properties: {} } },
        { name: "memory_update", description: "编辑/修改一条记忆", inputSchema: { type: "object", properties: { id: { type: "string" }, content: { type: "string" }, tags: { type: "array", items: { type: "string" } } }, required: ["id", "content"] } },
        { name: "memory_search_delete", description: "按关键词搜索并删除匹配的记忆", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } }
      ] } });
    case "tools/call":
      const toolName = params?.name;
      const args = params?.arguments || {};
      let data = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf-8"));

      if (toolName === "memory_create") {
        data.push({ id: Date.now().toString(), content: args.content, tags: args.tags || [], createdAt: new Date().toISOString() });
        fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
        return res.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: "记忆已保存 ✅" }] } });
      }

      if (toolName === "memory_search") {
        const kw = args.query.toLowerCase();
        const results = data.filter(m => m.content.toLowerCase().includes(kw) || m.tags.some(t => t.toLowerCase().includes(kw))).reverse();
        return res.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: results.length ? results.map((m,i)=>`${i+1}. [${m.id}] ${m.content}`).join("\n\n") : "没有找到记忆" }] } });
      }

      if (toolName === "memory_list") {
        const results = data.slice(-(args.limit || 20)).reverse();
        return res.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: results.length ? results.map((m,i)=>`${i+1}. [${m.id}] ${m.content}`).join("\n\n") : "还没有记忆" }] } });
      }

      if (toolName === "memory_delete") {
        const before = data.length;
        data = data.filter(m => m.id !== args.id);
        if (data.length === before) {
          return res.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: "未找到该ID的记忆" }] } });
        }
        fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
        return res.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: `已删除记忆 ${args.id} ✅` }] } });
      }

      if (toolName === "memory_clear") {
        fs.writeFileSync(MEMORY_FILE, JSON.stringify([], null, 2));
        return res.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: "所有记忆已清空 ✅" }] } });
      }

      if (toolName === "memory_update") {
        let found = false;
        data = data.map(m => {
          if (m.id === args.id) {
            found = true;
            return { ...m, content: args.content, tags: args.tags || m.tags, updatedAt: new Date().toISOString() };
          }
          return m;
        });
        if (!found) {
          return res.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: "未找到该ID的记忆" }] } });
        }
        fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
        return res.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: `记忆 ${args.id} 已更新 ✅` }] } });
      }

      if (toolName === "memory_search_delete") {
        const kw = args.query.toLowerCase();
        const before = data.length;
        data = data.filter(m => !(m.content.toLowerCase().includes(kw) || m.tags.some(t => t.toLowerCase().includes(kw))));
        const deleted = before - data.length;
        if (deleted === 0) {
          return res.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: "没有找到匹配的记忆" }] } });
        }
        fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
        return res.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: `已删除 ${deleted} 条匹配的记忆 ✅` }] } });
      }

      return res.json({ jsonrpc: "2.0", id, error: { code: -32601, message: `Tool not found: ${toolName}` } });
    default:
      return res.json({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
  }
});

app.get("/health", (req, res) => { res.json({ status: "ok" }); });

app.listen(PORT, "0.0.0.0", () => { console.log(`🧠 MCP 记忆库 v2.0 运行在 :${PORT}/mcp`); });
