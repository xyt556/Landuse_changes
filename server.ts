import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API to check email access
  app.post("/api/verify-access", (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ success: false, message: "Email is required" });
      }

      const filePath = path.join(process.cwd(), "allowed_emails.txt");
      
      // If file doesn't exist, nobody is allowed (safe default)
      if (!fs.existsSync(filePath)) {
        return res.status(200).json({ success: false, message: "Access list not configured" });
      }

      const content = fs.readFileSync(filePath, "utf-8");
      const allowedEmails = content.split(/\r?\n/).map(e => e.trim().toLowerCase()).filter(e => e.length > 0);

      if (allowedEmails.includes(email.trim().toLowerCase())) {
        return res.json({ success: true });
      } else {
        return res.json({ success: false, message: "您输入的邮箱暂无访问权限，请联系管理员。" });
      }
    } catch (error) {
      console.error("Verification error:", error);
      res.status(500).json({ success: false, message: "服务器内部错误" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
