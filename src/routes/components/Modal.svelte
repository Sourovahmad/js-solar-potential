<script lang="ts">
  export let isOpen = false;
  export let onSubmit: (data: { firstName: string; lastName: string; email: string; phone: string }) => void;
  export let isFormLoading = false

  let firstName = '';
  let lastName = '';
  let email = '';
  let phone = '';

  function handleFormSubmit() {
    onSubmit({ firstName, lastName, email, phone });
  }
</script>

{#if isOpen}
  <div class="modal-backdrop">
    <div class="modal">
      <h2 style="margin-bottom: 15px; font-size:18px">Enter Your Details</h2>
      <form on:submit|preventDefault={handleFormSubmit}>
        <input placeholder="First Name" bind:value={firstName} required />
        <input placeholder="Last Name" bind:value={lastName} required />
        <input type="email" placeholder="Email" bind:value={email} required />
        <input type="tel" placeholder="Phone" bind:value={phone} required />

        <button  disabled={isFormLoading} type="submit">
            {isFormLoading ? 'Submitting...' : 'Submit & Download'}
        </button>
      </form>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed; inset: 0; background: rgba(0,0,0,0.5);
    display: flex; justify-content: center; align-items: center;
  }
  .modal {
    background: white; padding: 2rem; border-radius: 8px;
    width: 400px; max-width: 90%;
  }
  form { display: flex; flex-direction: column; gap: 1rem; }
  button { background: #2d4d31; color: white; padding: 0.75rem; border-radius: 4px; }
  input {
    padding: 10px;
    border: 1px solid rgb(206, 203, 203);
    border-radius: 10px;
  }
</style>
