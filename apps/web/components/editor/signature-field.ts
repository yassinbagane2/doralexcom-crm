import { mergeAttributes, Node } from "@tiptap/core"
import {
  SIGNATURE_FIELD_NODE,
  isSignerRole,
  type SignerRole,
} from "@workspace/api/contract"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    signatureField: {
      /** Places a box for `role` to sign in, at the caret. */
      insertSignatureField: (role: SignerRole) => ReturnType
    }
  }
}

export interface SignatureFieldOptions {
  /** "Customer signature", in the reader's language. */
  label: (role: SignerRole) => string
  /** "Signed by Ana Pop on 9 Nov 2026", in the reader's language. */
  caption: (name: string, signedAt: string) => string
}

/**
 * Where a party signs a contract, placed in the editor like DocuSeal places
 * fields on a PDF. Empty in the editor; once the contract is sent, the API
 * fills the party's signature in (see `fillSignatures`), and the box shows
 * the signature with who signed and when.
 */
export const SignatureField = Node.create<SignatureFieldOptions>({
  name: SIGNATURE_FIELD_NODE,
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return {
      label: (role) => role,
      caption: (name) => name,
    }
  },

  addAttributes() {
    return {
      role: {
        default: "customer",
        parseHTML: (element) => {
          const role = element.getAttribute("data-signature")
          return isSignerRole(role) ? role : "customer"
        },
        renderHTML: (attributes) => ({ "data-signature": attributes.role }),
      },
      // Filled in for display only; never saved (the API strips them).
      image: { default: null, rendered: false },
      signerName: { default: null, rendered: false },
      signedAt: { default: null, rendered: false },
    }
  },

  parseHTML() {
    return [{ tag: "span[data-signature]" }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const role = isSignerRole(node.attrs.role) ? node.attrs.role : "customer"
    const image = node.attrs.image as string | null
    const attributes = mergeAttributes(HTMLAttributes, {
      class: image ? "draft-signature is-signed" : "draft-signature",
      contenteditable: "false",
    })

    if (!image) {
      return ["span", attributes, this.options.label(role)]
    }
    return [
      "span",
      attributes,
      ["img", { src: image, alt: this.options.label(role) }],
      [
        "span",
        { class: "draft-signature-caption" },
        this.options.caption(
          String(node.attrs.signerName ?? ""),
          String(node.attrs.signedAt ?? "")
        ),
      ],
    ]
  },

  renderText({ node }) {
    const role = isSignerRole(node.attrs.role) ? node.attrs.role : "customer"
    return `[${this.options.label(role)}]`
  },

  addCommands() {
    return {
      insertSignatureField:
        (role) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { role } }),
    }
  },
})
