import { createFileRoute } from "@tanstack/react-router";
import { Configurator } from "@/components/addon/configurator";

export const Route = createFileRoute("/$config/configure")({ component: Configure });

function Configure() {
  return <Configurator />;
}
