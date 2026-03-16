import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, ImageIcon, Download, Save, Upload, X, Settings } from "lucide-react";
import type { CreativePack } from "@shared/schema";
import { cn } from "@/lib/utils";

// ─── Schema ──────────────────────────────────────────────────────────────────

const formSchema = z.object({
  formato: z.enum(["9:16", "1:1", "4:5", "16:9"], { required_error: "Selecione o formato" }),
  personalizable: z.boolean().default(true),
  prompt: z.string().min(10, "Descreva o criativo com pelo menos 10 caracteres"),
});

type FormValues = z.infer<typeof formSchema>;

const FORMAT_OPTIONS = [
  { value: "9:16", label: "Story / Status WhatsApp (9:16)" },
  { value: "1:1", label: "Feed Instagram / Facebook (1:1)" },
  { value: "4:5", label: "Feed Retrato (4:5)" },
  { value: "16:9", label: "Banner Horizontal (16:9)" },
];

const PROMPT_PLACEHOLDER = `Descreva o criativo que você quer gerar. Inclua: cores, estilo, tema, textos que devem aparecer, elementos visuais, público-alvo...

Exemplo: Arte para SIAPE sobre redução de taxa. Fundo escuro com roxo #6C2BD9. Headline grande: 'Reduza suas parcelas'. Botão rosa com 'Chame Agora'. Estilo moderno, sem pessoas.`;

const SYSTEM_PROMPT_PLACEHOLDER = `Defina aqui as diretrizes que a IA deve sempre seguir ao gerar criativos.
Exemplo:

Marca: Capital Go — empresa de crédito consignado
Paleta de cores: roxo escuro #6C2BD9 (dominante), azul elétrico #1E88E5 (destaque), rosa #E91E63 (CTAs)
Estilo: moderno, profissional, sem poluição visual
Sempre reservar espaço no topo para a logo
Nunca usar fotos de pessoas não autorizadas
Tom: confiança, agilidade, resultado`;

// ─── Save Dialog ──────────────────────────────────────────────────────────────

interface SaveDialogProps {
  open: boolean;
  onClose: () => void;
  generationId: number | null;
  selectedImageUrl: string | null;
  packs: CreativePack[];
  onSaved: () => void;
}

function SaveDialog({ open, onClose, generationId, selectedImageUrl, packs, onSaved }: SaveDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [packId, setPackId] = useState<string>("");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/creatives/save-generation", {
        generationId,
        selectedImageUrl,
        name,
        packId: Number(packId),
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Criativo salvo na galeria!" });
      onSaved();
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar", description: err?.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Salvar na Galeria</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nome do criativo</Label>
            <Input
              data-testid="input-creative-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: INSS Portabilidade Março"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Pack</Label>
            <Select value={packId} onValueChange={setPackId}>
              <SelectTrigger data-testid="select-save-pack">
                <SelectValue placeholder="Selecione um pack" />
              </SelectTrigger>
              <SelectContent>
                {packs.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            data-testid="button-confirm-save"
            disabled={!name.trim() || !packId || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Brand Config Tab ─────────────────────────────────────────────────────────

function BrandConfigTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: brandConfig, isLoading } = useQuery<{
    systemPrompt: string;
    logoUrl: string | null;
    hasLogo: boolean;
  }>({ queryKey: ["/api/creatives/brand-config"] });

  const [systemPrompt, setSystemPrompt] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  // Populate from server data
  useEffect(() => {
    if (brandConfig) {
      setSystemPrompt(brandConfig.systemPrompt || "");
      if (brandConfig.logoUrl && !logoPreview) {
        setLogoPreview(brandConfig.logoUrl);
      }
    }
  }, [brandConfig]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("systemPrompt", systemPrompt);
      if (logoFile) fd.append("logo", logoFile);
      const res = await fetch("/api/creatives/brand-config", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Erro ao salvar");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/creatives/brand-config"] });
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
      toast({ title: "Configurações de marca salvas!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar", description: err?.message, variant: "destructive" });
    },
  });

  const removeLogo = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/creatives/brand-config/logo", {});
      return res.json();
    },
    onSuccess: () => {
      setLogoFile(null);
      setLogoPreview(null);
      qc.invalidateQueries({ queryKey: ["/api/creatives/brand-config"] });
      toast({ title: "Logo removida" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao remover logo", description: err?.message, variant: "destructive" });
    },
  });

  function handleFileChange(file: File | null) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 2MB", variant: "destructive" });
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setLogoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileChange(file);
  }

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Logo Upload */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Upload da Logo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {logoPreview ? (
            <div className="flex items-start gap-4">
              <div className="border rounded-md p-3 bg-muted/30">
                <img
                  src={logoPreview}
                  alt="Logo atual"
                  className="max-h-24 max-w-48 object-contain"
                  data-testid="img-logo-preview"
                />
              </div>
              <div className="flex flex-col gap-2 pt-1">
                <p className="text-sm text-muted-foreground">Logo atual</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid="button-change-logo"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  Trocar logo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid="button-remove-logo"
                  disabled={removeLogo.isPending}
                  onClick={() => {
                    setLogoPreview(null);
                    setLogoFile(null);
                    if (brandConfig?.hasLogo) removeLogo.mutate();
                  }}
                >
                  <X className="w-3.5 h-3.5 mr-1.5" />
                  Remover logo
                </Button>
              </div>
            </div>
          ) : (
            <div
              data-testid="dropzone-logo"
              className="border-2 border-dashed rounded-md p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover-elevate"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Upload className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Clique ou arraste a logo aqui</p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG ou SVG — máx 2MB</p>
              </div>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            className="hidden"
            data-testid="input-logo-file"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          />
        </CardContent>
      </Card>

      {/* System Prompt */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Diretrizes de Geração de Criativos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Defina as regras de marca que a IA sempre seguirá ao gerar imagens. Estas diretrizes serão aplicadas automaticamente em todas as gerações.
          </p>
          <Textarea
            data-testid="textarea-system-prompt"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={10}
            placeholder={SYSTEM_PROMPT_PLACEHOLDER}
          />
        </CardContent>
      </Card>

      {/* Save */}
      <div className="space-y-2">
        <Button
          type="button"
          data-testid="button-save-brand-config"
          className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? "Salvando..." : "Salvar configurações"}
        </Button>
        {savedOk && (
          <p className="text-sm text-center text-green-600 dark:text-green-400">
            Configurações salvas com sucesso!
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CriadorCriativosPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isMaster = user?.isMaster === true;

  const [generationResult, setGenerationResult] = useState<{
    generationId: number;
    images: string[];
    quotaUsed: number;
  } | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPreviewImage(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const { data: quota, refetch: refetchQuota } = useQuery<{ used: number; limit: number | null; resetsAt: string | null; unlimited?: boolean }>({
    queryKey: ["/api/creatives/quota"],
  });

  const { data: packs = [] } = useQuery<CreativePack[]>({
    queryKey: ["/api/creative-packs"],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      formato: "1:1",
      personalizable: true,
      prompt: "",
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await apiRequest("POST", "/api/creatives/generate", data);
      return await res.json();
    },
    onSuccess: (data: any) => {
      setGenerationResult(data);
      setSelectedImage(null);
      refetchQuota();
    },
    onError: (err: any) => {
      const msg = err?.message || "Erro ao gerar imagens. Tente novamente.";
      toast({ title: "Erro na geração", description: msg, variant: "destructive" });
    },
  });

  const isUnlimited = quota?.unlimited === true;
  const quotaUsed = quota?.used ?? 0;
  const quotaLimit = quota?.limit ?? 5;
  const atLimit = !isUnlimited && quotaUsed >= quotaLimit;

  function downloadImage(url: string, idx: number) {
    const a = document.createElement("a");
    a.href = url;
    a.download = `criativo-${idx + 1}.png`;
    a.click();
  }

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          Criador de Criativos IA
        </h1>
        <p className="text-sm text-muted-foreground">Gere peças de marketing personalizadas com inteligência artificial</p>
      </div>

      <Tabs defaultValue="criar">
        <TabsList className="mb-6" data-testid="tabs-criador">
          <TabsTrigger value="criar" data-testid="tab-criar">Criar Criativo</TabsTrigger>
          {isMaster && (
            <TabsTrigger value="config" data-testid="tab-config-marca">
              <Settings className="w-3.5 h-3.5 mr-1.5" />
              Configuração de Marca
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Aba Criar ── */}
        <TabsContent value="criar">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ── Coluna Esquerda: Formulário ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Configurar Criativo</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form
                    data-testid="form-criador"
                    onSubmit={form.handleSubmit((data) => generateMutation.mutate(data))}
                    className="space-y-5"
                  >
                    {/* Formato */}
                    <FormField control={form.control} name="formato" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Formato</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-formato">
                              <SelectValue placeholder="Selecione o formato" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {FORMAT_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />

                    {/* Personalizável */}
                    <FormField control={form.control} name="personalizable" render={({ field }) => (
                      <FormItem>
                        <div className="flex items-start gap-3">
                          <FormControl>
                            <Checkbox
                              data-testid="checkbox-personalizable"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="mt-0.5"
                            />
                          </FormControl>
                          <FormLabel className="cursor-pointer font-normal leading-snug">
                            Arte personalizável (adicionar espaço para assinatura do corretor)
                          </FormLabel>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )} />

                    {/* Prompt */}
                    <FormField control={form.control} name="prompt" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descreva o criativo</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={6}
                            data-testid="textarea-prompt"
                            placeholder={PROMPT_PLACEHOLDER}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <Separator />

                    {/* Quota indicator */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Gerações hoje:</span>
                      {isUnlimited ? (
                        <span className="font-medium text-purple-500">Ilimitado</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            {Array.from({ length: quotaLimit }).map((_, i) => (
                              <div
                                key={i}
                                className={cn(
                                  "w-3 h-3 rounded-full",
                                  i < quotaUsed ? "bg-purple-500" : "bg-muted"
                                )}
                              />
                            ))}
                          </div>
                          <span className={cn("font-medium", atLimit ? "text-destructive" : "text-foreground")}>
                            {quotaUsed} / {quotaLimit}
                          </span>
                        </div>
                      )}
                    </div>

                    {atLimit && (
                      <p className="text-xs text-destructive">
                        Limite atingido. Resets em {quota?.resetsAt}.
                      </p>
                    )}

                    <Button
                      type="submit"
                      data-testid="button-gerar-criativo"
                      className="w-full"
                      disabled={atLimit || generateMutation.isPending}
                    >
                      {generateMutation.isPending ? (
                        <>Gerando imagens... (pode levar 20–30s)</>
                      ) : (
                        <><Sparkles className="w-4 h-4 mr-2" />Gerar Criativo</>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* ── Coluna Direita: Resultado ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Resultado</CardTitle>
              </CardHeader>
              <CardContent>
                {generateMutation.isPending ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground text-center mb-4">
                      Gerando 4 variações... Isso pode levar alguns segundos.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="aspect-square rounded-md w-full" />
                      ))}
                    </div>
                  </div>
                ) : generationResult ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Clique para visualizar em tela cheia
                      </p>
                      {selectedImage && (
                        <Badge variant="secondary" className="text-purple-600">1 selecionada</Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {generationResult.images.map((url, idx) => (
                        <div
                          key={idx}
                          data-testid={`image-result-${idx}`}
                          className={cn(
                            "relative rounded-md overflow-hidden cursor-pointer border-2 transition-all",
                            selectedImage === url
                              ? "border-purple-500 ring-2 ring-purple-200 dark:ring-purple-800"
                              : "border-transparent hover:border-muted-foreground/30"
                          )}
                          onClick={() => setPreviewImage(url)}
                        >
                          <img
                            src={url}
                            alt={`Variação ${idx + 1}`}
                            className="w-full aspect-square object-cover"
                          />
                          {selectedImage === url && (
                            <div className="absolute top-2 right-2 bg-purple-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                              ✓
                            </div>
                          )}
                          <Button
                            type="button"
                            size="icon"
                            variant="secondary"
                            className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 w-7 h-7"
                            data-testid={`button-download-${idx}`}
                            onClick={(e) => { e.stopPropagation(); downloadImage(url, idx); }}
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <Separator />

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        data-testid="button-download-selected"
                        disabled={!selectedImage}
                        onClick={() => selectedImage && downloadImage(selectedImage, 0)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Baixar selecionada
                      </Button>
                      <Button
                        type="button"
                        className="flex-1"
                        data-testid="button-save-gallery"
                        disabled={!selectedImage || packs.length === 0}
                        onClick={() => setSaveDialogOpen(true)}
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Salvar na Galeria
                      </Button>
                    </div>

                    {packs.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center">
                        Crie um pack na galeria de Criativos para poder salvar aqui.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                      <ImageIcon className="w-7 h-7 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Nenhum criativo gerado</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Preencha o formulário e clique em "Gerar Criativo" para começar.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Aba Config (apenas master) ── */}
        {isMaster && (
          <TabsContent value="config">
            <BrandConfigTab />
          </TabsContent>
        )}
      </Tabs>

      <SaveDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        generationId={generationResult?.generationId ?? null}
        selectedImageUrl={selectedImage}
        packs={packs}
        onSaved={() => {
          setGenerationResult(null);
          setSelectedImage(null);
        }}
      />

      {/* ── Fullscreen Image Preview Modal ── */}
      {previewImage && (
        <div
          data-testid="overlay-image-preview"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewImage}
              alt="Visualização em tela cheia"
              style={{ maxHeight: "80vh", maxWidth: "90vw" }}
              className="rounded-md object-contain shadow-2xl"
            />
            <div className="flex gap-3">
              <Button
                data-testid="button-preview-select"
                className="bg-purple-600 hover:bg-purple-700 text-white"
                onClick={() => {
                  setSelectedImage(previewImage);
                  setPreviewImage(null);
                }}
              >
                Selecionar esta imagem
              </Button>
              <Button
                data-testid="button-preview-close"
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10"
                onClick={() => setPreviewImage(null)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
