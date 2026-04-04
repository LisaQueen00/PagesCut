import { useEffect } from "react";
import { useAppStore } from "@/store/appStore";

export function useBootstrap() {
  const bootstrap = useAppStore((state) => state.bootstrap);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);
}
