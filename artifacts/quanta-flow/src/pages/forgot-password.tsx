import { Link } from "wouter";
import { ArrowLeft, ShieldAlert, Mail } from "lucide-react";
import { QuantaLogo } from "@/components/quanta-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ForgotPassword() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <QuantaLogo size="lg" />
          </div>
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-3xl font-bold text-secondary">Quanta</span>
            <span className="text-3xl font-light text-muted-foreground">FLOW</span>
          </div>
        </div>

        <Card className="border-card-border shadow-lg">
          <CardHeader className="space-y-1 pb-4 text-center">
            <div className="flex justify-center mb-2">
              <div className="p-3 rounded-full bg-primary/10">
                <ShieldAlert className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-semibold">Esqueci minha senha</CardTitle>
            <CardDescription>
              Recupere o acesso à sua conta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Para redefinir sua senha, entre em contato com o administrador do sistema.
              </p>
              <div className="rounded-md bg-muted p-4 space-y-2">
                <p className="font-medium text-foreground">Como funciona:</p>
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>Contate o administrador da sua empresa</li>
                  <li>O administrador irá redefinir sua senha</li>
                  <li>Você receberá uma senha temporária</li>
                  <li>No próximo login, será solicitado criar uma nova senha</li>
                </ol>
              </div>
              <div className="flex items-start gap-2 rounded-md bg-primary/5 p-3">
                <Mail className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <p className="text-xs">
                  Se você é administrador e precisa redefinir sua própria senha, acesse o painel de gestão de usuários ou contate outro administrador.
                </p>
              </div>
            </div>

            <Button asChild variant="outline" className="w-full" data-testid="button-back-login">
              <Link href="/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para o login
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
