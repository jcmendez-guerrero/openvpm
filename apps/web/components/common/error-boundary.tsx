"use client";

import { Component, type ReactNode } from "react";
import { useTranslations } from "use-intl";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/components/common/report-client-error";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    reportClientError("react-error-boundary", error);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <ErrorFallback
          message={this.state.error?.message}
          onRetry={() => this.setState({ hasError: false, error: null })}
        />
      );
    }

    return this.props.children;
  }
}

// Class components can't call hooks, so the translated fallback lives here.
function ErrorFallback({ message, onRetry }: { message?: string; onRetry: () => void }) {
  const t = useTranslations("common");
  return (
    <div role="alert" className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8">
      <div className="rounded-full bg-destructive/10 p-3">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-heading text-lg font-semibold">{t("errorBoundaryTitle")}</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {message || t("unexpectedError")}
        </p>
      </div>
      <Button variant="outline" onClick={onRetry}>
        <RotateCcw className="mr-2 h-4 w-4" />
        {t("tryAgainButton")}
      </Button>
    </div>
  );
}
