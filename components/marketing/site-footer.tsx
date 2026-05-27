const GITHUB_URL = "https://github.com/PrakarshKamal/blacklight";
const LINKEDIN_URL = "https://www.linkedin.com/in/prakarsh-kamal/";

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-800/80">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-4 px-4 py-8 text-sm text-zinc-500 sm:px-6">
        <p className="text-center text-zinc-400">
          Antivirus secured computers. Blacklight secures what your AI reads.
        </p>
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-4">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 transition-colors hover:text-violet-300"
          >
            GitHub
          </a>
          <span className="hidden text-zinc-700 sm:inline">·</span>
          <p className="text-zinc-500">
            Built by{" "}
            <a
              href={LINKEDIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-300 transition-colors hover:text-violet-300"
            >
              Prakarsh
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
