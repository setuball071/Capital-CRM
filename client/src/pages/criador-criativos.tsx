import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Sparkles, ImageIcon, Download, Save } from "lucide-react";
import type { CreativePack } from "@shared/schema";
import { cn } from "@/lib/utils";

// ─── Schema ──────────────────────────────────────────────────────────────────

const exampleSchema = z.object({
  label: z.string().min(1, "Informe o rótulo"),
  value: z.string().min(1, "Informe o valor"),
});

const formSchema = z.object({
  formato: z.enum(["square", "portrait", "story", "banner"], { required_error: "Selecione o formato" }),
  convenio: z.string().min(1, "Informe o convênio"),
  tema: z.string().min(1, "Informe o tema"),
  headline: z.string().min(1, "Informe a headline"),
  examples: z.array(exampleSchema).max(3),
  cta: z.string().min(1, "Informe o CTA"),
  style: z.enum(["fotorrealista", "moderno_clean", "bold_typographic"], { required_error: "Selecione o estilo" }),
});

type FormValues = z.infer<typeof formSchema>;

const FORMAT_LABELS: Record<string, string> = {
  square: "Post WhatsApp (1:1)",
  portrait: "Flyer Vertical (4:5)",
  story: "Story (9:16)",
  banner: "Banner (4:5)",
};

const STYLE_LABELS: Record<string, string> = {
  fotorrealista: "Fotorrealista",
  moderno_clean: "Moderno Clean",
  bold_typographic: "Bold Typographic",
};

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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CriadorCriativosPage() {
  const { toast } = useToast();
  const [generationResult, setGenerationResult] = useState<{
    generationId: number;
    images: string[];
    quotaUsed: number;
  } | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  const { data: quota, refetch: refetchQuota } = useQuery<{ used: number; limit: number; resetsAt: string }>({
    queryKey: ["/api/creatives/quota"],
  });

  const { data: packs = [] } = useQuery<CreativePack[]>({
    queryKey: ["/api/creative-packs"],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      formato: "square",
      convenio: "",
      tema: "",
      headline: "",
      examples: [],
      cta: "",
      style: "moderno_clean",
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "examples" });

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

  const quotaUsed = quota?.used ?? 0;
  const quotaLimit = quota?.limit ?? 5;
  const atLimit = quotaUsed >= quotaLimit;

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
                className="space-y-4"
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
                        {Object.entries(FORMAT_LABELS).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Convênio */}
                <FormField control={form.control} name="convenio" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Convênio</FormLabel>
                    <FormControl>
                      <Input data-testid="input-convenio" placeholder="Ex: INSS, SIAPE, Governo Estadual" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Tema */}
                <FormField control={form.control} name="tema" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tema / Campanha</FormLabel>
                    <FormControl>
                      <Input data-testid="input-tema" placeholder="Ex: Portabilidade Consignado, Refinanciamento" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Headline */}
                <FormField control={form.control} name="headline" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Headline principal</FormLabel>
                    <FormControl>
                      <Input data-testid="input-headline" placeholder="Ex: Transfira seu empréstimo e pague menos" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Exemplos */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Exemplos de valores <span className="text-muted-foreground text-xs">(máx. 3)</span></Label>
                    {fields.length < 3 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        data-testid="button-add-example"
                        onClick={() => append({ label: "", value: "" })}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Adicionar
                      </Button>
                    )}
                  </div>
                  {fields.map((field, idx) => (
                    <div key={field.id} className="flex gap-2 items-start">
                      <FormField control={form.control} name={`examples.${idx}.label`} render={({ field: f }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input data-testid={`input-example-label-${idx}`} placeholder="Rótulo (ex: Parcela)" {...f} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name={`examples.${idx}.value`} render={({ field: f }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input data-testid={`input-example-value-${idx}`} placeholder="Valor (ex: R$ 320/mês)" {...f} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        data-testid={`button-remove-example-${idx}`}
                        onClick={() => remove(idx)}
                        className="mt-0.5 shrink-0"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <FormField control={form.control} name="cta" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Call to Action (CTA)</FormLabel>
                    <FormControl>
                      <Input data-testid="input-cta" placeholder="Ex: Solicite uma simulação agora" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Estilo */}
                <FormField control={form.control} name="style" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estilo visual</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-style">
                          <SelectValue placeholder="Selecione o estilo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(STYLE_LABELS).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <Separator />

                {/* Quota indicator */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Gerações hoje:</span>
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
              /* Loading skeletons */
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
                    Clique em uma imagem para selecioná-la
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
                      onClick={() => setSelectedImage(url)}
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
              /* Empty state */
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

      {/* Save dialog */}
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
    </div>
  );
}
