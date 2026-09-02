import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3003;
const MEMORY_FILE = path.join(__dirname, "memories.json");

app.use(express.json());

// 初始化
if (!fs.existsSync(MEMORY_FILE)) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify([], null, 2));
}

// 读取所有记忆
app.get("/memories", (req, res) => {
  const data = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf-8"));
  const { search, limit } = req.query;
  let result = data;
  
  if (search) {
    const kw = search.toLowerCase();
    result = data.filter(m => 
      m.content.toLowerCase().includes(kw) || 
      (m.tags && m.tags.some(t => t.toLowerCase().includes(kw)))
    );
  }
  
  if (limit) {
    result = result.slice(-parseInt(limit));
  }
  
  res.json(result.reverse());
});

// 添加记忆
app.post("/memories", (req, res) => {
  const { content, tags } = req.body;
  if (!content) return res.status(400).json({ error: "内容不能为空" });
  
  const data = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf-8"));
  const memory = {
    id: Date.now().toString(),
    content,
    tags: tags || [],
    createdAt: new Date().toISOString()
  };
  data.push(memory);
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
  res.json(memory);
});

// 删除记忆
app.delete("/memories/:id", (req, res) => {
  let data = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf-8"));
  data = data.filter(m => m.id !== req.params.id);
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
  res.json({ ok: true });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🧠 记忆库服务运行在 http://0.0.0.0:${PORT}`);
});
