export type IdRouteContext = {
  params: Promise<unknown>;
};

export async function getRouteId(context: IdRouteContext): Promise<string> {
  const params = (await context.params) as { id?: string };

  if (!params.id) {
    throw new Response("Missing route id", { status: 400 });
  }

  return params.id;
}
