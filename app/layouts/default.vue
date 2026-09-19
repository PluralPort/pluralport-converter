<template>
  <div class="isolate flex min-h-dvh flex-col bg-bg text-text antialiased">
    <Navbar />

    <main class="flex-1">
      <div class="mx-auto w-full max-w-300 px-6">
        <slot />
      </div>
    </main>

    <Footer />
  </div>
</template>
