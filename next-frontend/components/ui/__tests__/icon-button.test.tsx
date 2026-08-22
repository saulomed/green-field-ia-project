import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { IconButton } from "@/components/ui/icon-button"

describe("<IconButton>", () => {
  it("exposes the required accessible name", () => {
    render(<IconButton aria-label="Show password" />)
    expect(screen.getByRole("button", { name: "Show password" })).toBeInTheDocument()
  })

  it("fires the click handler", async () => {
    const onClick = vi.fn()
    render(<IconButton aria-label="Show password" onClick={onClick} />)
    await userEvent.click(screen.getByRole("button", { name: "Show password" }))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
