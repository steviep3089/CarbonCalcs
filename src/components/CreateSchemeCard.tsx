"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type CreateSchemeState = {
  error?: string;
  success?: boolean;
};

type CreateSchemeCardProps = {
  action: (
    prevState: CreateSchemeState,
    formData: FormData
  ) => Promise<CreateSchemeState>;
};

const initialState: CreateSchemeState = {};

export function CreateSchemeCard({ action }: CreateSchemeCardProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      setOpen(false);
      router.refresh();
    }
  }, [state?.success, router]);

  return (
    <section className="create-scheme">
      {!open ? (
        <button
          type="button"
          className="btn-primary"
          onClick={() => setOpen(true)}
        >
          Add scheme
        </button>
      ) : (
        <div className="create-scheme-card">
          <div>
            <h3 className="display-text" style={{ margin: 0 }}>
              New scheme
            </h3>
            <p className="create-scheme-subtitle">
              Add a scheme name to begin capturing materials.
            </p>
          </div>

          <form action={formAction} className="create-scheme-form">
            <label>
              Scheme name
              <input
                type="text"
                name="name"
                placeholder="Scheme name"
                autoFocus
              />
            </label>

            <label>
              Area (m2)
              <input
                type="number"
                name="area_m2"
                placeholder="e.g. 1250"
                step="0.01"
                min="0"
              />
            </label>

            <label>
              Site postcode
              <input
                type="text"
                name="site_postcode"
                placeholder="e.g. CV09 2RS"
              />
            </label>
            <label>
              Base postcode
              <input
                type="text"
                name="base_postcode"
                placeholder="e.g. B1 1AA"
              />
            </label>

            <div className="create-scheme-actions">
              <button className="btn-primary" type="submit">
                Create scheme
              </button>
              <button
                className="btn-secondary"
                type="button"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
            </div>
          </form>

          {state?.error ? (
            <p className="create-scheme-message error">{state.error}</p>
          ) : null}
          {state?.success ? (
            <p className="create-scheme-message success">
              Scheme created successfully.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
