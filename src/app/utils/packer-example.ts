/**
 * Un exemple de configuration Packer, proposé par le bouton « Exemple Debian 12 » de la modale
 * « Créer un template » (repris de la collection Bruno de l'API : docs/bruno/07-Templates).
 *
 * Il part de l'image cloud officielle de Debian 12 : cloud-init (cd_content) crée le compte
 * « packer » qui sert à Packer pour se connecter en SSH ; ce compte est verrouillé à la fin.
 * Seul ce fichier est envoyé à Packer : tout (cloud-init, scripts) doit donc y être écrit.
 * La machine qui construit a besoin de packer, qemu-system-x86_64, qemu-img, virsh, xorriso,
 * /dev/kvm et d'un accès à Internet. Compter 3 à 10 minutes.
 */
export const PACKER_EXAMPLE = {
  name: 'debian-12',
  /** Le nom du fichier écrit par Packer : la valeur de vm_name dans la configuration. */
  diskName: 'debian-12.qcow2',
  config: `packer {
  required_plugins {
    qemu = {
      source  = "github.com/hashicorp/qemu"
      version = ">= 1.1.0"
    }
  }
}

source "qemu" "debian" {
  iso_url          = "https://cloud.debian.org/images/cloud/bookworm/latest/debian-12-genericcloud-amd64.qcow2"
  iso_checksum     = "file:https://cloud.debian.org/images/cloud/bookworm/latest/SHA512SUMS"
  disk_image       = true
  disk_size        = "10G"
  format           = "qcow2"
  vm_name          = "debian-12.qcow2"
  output_directory = "output"
  headless         = true
  accelerator      = "kvm"
  memory           = 1024

  cd_label = "cidata"
  cd_content = {
    "meta-data" = "instance-id: packer\\nlocal-hostname: debian-12\\n"
    "user-data" = <<-EOF
      #cloud-config
      ssh_pwauth: true
      users:
        - name: packer
          plain_text_passwd: packer
          lock_passwd: false
          sudo: ALL=(ALL) NOPASSWD:ALL
          shell: /bin/bash
    EOF
  }

  communicator     = "ssh"
  ssh_username     = "packer"
  ssh_password     = "packer"
  ssh_timeout      = "10m"
  shutdown_command = "sudo shutdown -P now"
}

build {
  sources = ["source.qemu.debian"]

  provisioner "shell" {
    inline = [
      "sudo apt-get update",
      "sudo DEBIAN_FRONTEND=noninteractive apt-get -y upgrade",
      "sudo cloud-init clean --logs",
      "sudo passwd -l packer",
    ]
  }
}
`,
};

/**
 * Retrouve le nom du disque (vm_name) dans une configuration Packer, en HCL (vm_name = "x")
 * ou en JSON ("vm_name": "x"). Renvoie null s'il n'y est pas.
 */
export function detectDiskName(config: string): string | null {
  const found = /"?vm_name"?\s*[=:]\s*"([^"]+)"/.exec(config);
  return found ? found[1] : null;
}
