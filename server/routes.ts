import type { Express } from "express";
import { createServer, type Server } from "http";
import { simulationInputSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Validate simulation input
  app.post("/api/validate-simulation", async (req, res) => {
    try {
      const result = simulationInputSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({
          success: false,
          errors: result.error.errors,
        });
      }

      return res.json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Erro ao validar dados",
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
