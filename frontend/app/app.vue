<template>
  <div>
    <NuxtPwaManifest />
    <NuxtRouteAnnouncer />
    <RfStudio />
    <ClientOnly>
      <StudioPwaPrompt />
    </ClientOnly>
  </div>
</template>
