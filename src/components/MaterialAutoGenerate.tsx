"use client";

import { useActionState, useEffect } from "react";
import { autoGenerateMaterialTonnage } from "@/app/schemes/[schemeId]/actions";

type ActionState = {
  ok?: boolean;
  error?: string;
};

export function MaterialAutoGenerate({ schemeId }: { schemeId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(
    async () => autoGenerateMaterialTonnage(schemeId),
    {}
  );

  useEffect(() => {
    if (state?.error) {
      window.alert(state.error);
    }
  }, [state?.error]);

  return (
    <>
      <div className="scheme-center-actions">
        <form action={action}>
          <button className="btn-secondary" type="submit">
            Auto generate tonnes
          </button>
        </form>
      </div>
      {state?.ok ? (
        <p className="create-scheme-message success">Auto generated tonnes.</p>
      ) : null}
      {state?.error ? (
        <p className="create-scheme-message error">{state.error}</p>
      ) : null}
    </>
  );
}
