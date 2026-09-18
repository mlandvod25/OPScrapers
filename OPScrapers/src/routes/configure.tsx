import { createFileRoute } from "@tanstack/react-router";
import { Configurator } from "@/components/addon/configurator";

export const Route = createFileRoute("/configure")({ component: Configure });

function Configure() {
  return <Configurator />;
}
